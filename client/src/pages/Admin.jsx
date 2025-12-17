import React, { useState, useEffect } from 'react';
import { db } from '../db/schema';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import { Trash2, UserPlus, Key, Shield, AlertTriangle, Database, Download, Upload, Pencil, X, Check, Plus, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const Admin = () => {
    const { user, roles } = useAuth();
    const { deployments } = useDeployment();
    const [users, setUsers] = useState([]);
    const [accessRequests, setAccessRequests] = useState([]);
    const [apiKeys, setApiKeys] = useState([]);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('Sitrep.Editor');
    const [newKeyName, setNewKeyName] = useState('');
    const [generatedKey, setGeneratedKey] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('admin'); // 'admin' or 'developer'

    // File input ref for restore
    const fileInputRef = React.useRef(null);

    // Deployment assignment state
    const [selectedDeployments, setSelectedDeployments] = useState([]);

    // Import State
    const [selectedImportDeployment, setSelectedImportDeployment] = useState('');

    // Trigger file input click safely
    const handleRestoreTrigger = () => {
        fileInputRef.current?.click();
    };

    // Edit Mode State
    const [editingUser, setEditingUser] = useState(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const loadedUsers = await db.users.toArray();
            const loadedRequests = await db.accessRequests.where('status').equals('Pending').toArray();
            const loadedKeys = await db.apiKeys.toArray();

            setUsers(loadedUsers);
            setAccessRequests(loadedRequests);
            setApiKeys(loadedKeys);
        } catch (error) {
            console.error('Error loading admin data', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Access Requests ---
    const handleApproveRequest = async (request) => {
        try {
            await db.transaction('rw', db.users, db.accessRequests, async () => {
                // Add to users
                const existing = await db.users.where('email').equals(request.email).first();
                if (!existing) {
                    await db.users.add({
                        email: request.email,
                        role: 'Sitrep.Editor', // Default role
                        addedBy: user.username,
                        createdAt: new Date().toISOString()
                    });
                }
                // Update request status
                await db.accessRequests.update(request.id, { status: 'Approved' });
            });
            await loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to approve');
        }
    };

    const handleDenyRequest = async (request) => {
        try {
            await db.accessRequests.update(request.id, { status: 'Denied' });
            await loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to deny');
        }
    };

    // --- User Management ---

    const startEdit = (targetUser) => {
        setEditingUser(targetUser);
        setNewUserEmail(targetUser.email);
        setNewUserRole(targetUser.role);

        // Find deployments this user is assigned to
        const assignedIds = deployments
            .filter(d => {
                const emails = d.userEmails
                    ? (Array.isArray(d.userEmails) ? d.userEmails : String(d.userEmails).split(',').map(e => e.trim()))
                    : [];
                return emails.includes(targetUser.email);
            })
            .map(d => d.id);

        setSelectedDeployments(assignedIds);
    };

    const cancelEdit = () => {
        setEditingUser(null);
        setNewUserEmail('');
        setNewUserRole('Sitrep.Editor');
        setSelectedDeployments([]);
    };

    const generateTempPassword = () => {
        // e.g., "Abc#1234" like pattern
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
        let pass = "";
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        if (!newUserEmail) return;

        try {
            let tempPass = null;

            await db.transaction('rw', db.users, db.deployments, async () => {

                if (editingUser) {
                    // UPDATE EXISTING
                    await db.users.update(editingUser.id, {
                        role: newUserRole,
                    });
                } else {
                    // CREATE NEW
                    const existing = await db.users.where('email').equals(newUserEmail).first();
                    if (existing) {
                        alert('User already exists');
                        return;
                    }

                    tempPass = generateTempPassword(); // Generate temp password for new user

                    await db.users.add({
                        email: newUserEmail,
                        role: newUserRole,
                        addedBy: user.username,
                        tempPassword: tempPass,
                        mustChangePassword: true,
                        createdAt: new Date().toISOString()
                    });
                }

                // Update Deployments
                const allDeployments = await db.deployments.toArray();

                for (const d of allDeployments) {
                    const email = editingUser ? editingUser.email : newUserEmail;
                    let emails = d.userEmails
                        ? (Array.isArray(d.userEmails) ? [...d.userEmails] : String(d.userEmails).split(',').map(e => e.trim()).filter(e => e))
                        : [];

                    const shouldBeAssigned = selectedDeployments.includes(d.id);
                    const isAssigned = emails.includes(email);

                    if (shouldBeAssigned && !isAssigned) {
                        emails.push(email);
                        await db.deployments.update(d.id, { userEmails: emails });
                    } else if (!shouldBeAssigned && isAssigned) {
                        emails = emails.filter(e => e !== email);
                        await db.deployments.update(d.id, { userEmails: emails });
                    }
                }

            });

            if (tempPass) {
                alert(`User created! \nTemporary Password: ${tempPass}\n\nPlease share this securely with the user.`);
            }

            cancelEdit();
            loadData();
        } catch (error) {
            console.error('Error saving user:', error);
            alert('Failed to save user');
        }
    };

    const handleResetPassword = async (userId) => {
        if (!confirm("Are you sure you want to reset this user's password? It will set a temporary one.")) return;

        try {
            const tempPass = generateTempPassword();
            await db.users.update(userId, {
                passwordHash: null,
                tempPassword: tempPass,
                mustChangePassword: true
            });
            alert(`Password Reset!\nTemporary Password: ${tempPass}\n\nPlease share this securely with the user.`);
        } catch (e) {
            console.error(e);
            alert("Failed to reset password.");
        }
    };

    const handleDeleteUser = async (id) => {
        if (!confirm('Are you sure? This will remove their explicit permissions.')) return;
        try {
            await db.users.delete(id);
            await loadData();
        } catch (error) {
            console.error(error);
        }
    };

    // --- Database Management ---
    const handleBackup = async () => {
        try {
            const allData = {};
            // Iterate all tables defined in schema
            for (const table of db.tables) {
                allData[table.name] = await table.toArray();
            }
            const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SITREP_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Backup failed:', error);
            alert('Failed to create backup.');
        }
    };

    const handleRestore = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('WARNING: This will overwrite ALL current data with the backup file. This cannot be undone. Continue?')) {
            e.target.value = ''; // Reset input
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);

                await db.transaction('rw', db.tables, async () => {
                    // 1. Clear all tables
                    await Promise.all(db.tables.map(table => table.clear()));

                    // 2. Import data
                    for (const tableName of Object.keys(data)) {
                        if (db[tableName]) {
                            await db[tableName].bulkAdd(data[tableName]);
                        }
                    }
                });

                alert('System restored successfully. The page will now reload.');
                window.location.reload();
            } catch (error) {
                console.error('Restore failed:', error);
                alert('Failed to restore data: ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    // --- API Key Management ---
    const generateApiKey = async (e) => {
        e.preventDefault();
        if (!newKeyName) return;

        const key = 'sk_' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);

        try {
            // Add to Local DB
            await db.apiKeys.add({
                key: key,
                name: newKeyName,
                status: 'Active',
                createdAt: new Date().toISOString()
            });

            // Attempt to Sync to Backend
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                await fetch(`${apiUrl}/v1/admin/keys`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newKeyName, key: key })
                });
            } catch (serverError) {
                console.warn('Backend server not reachable, key only saved locally:', serverError);
            }

            setGeneratedKey(key);
            setNewKeyName('');
            loadData();
        } catch (error) {
            console.error('Failed to create key', error);
        }
    };

    const handleRevokeKey = async (id) => {
        if (confirm('Revoke this API Key? It will no longer work.')) {
            await db.apiKeys.update(id, { status: 'Revoked' });
            loadData();
        }
    };



    // --- Data Imports ---

    const handleHistoricalDeployment = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const location = formData.get('location');
        const startDate = formData.get('startDate');

        try {
            await db.deployments.add({
                name,
                location,
                startDate,
                status: 'Completed',     // Historical
                type: 'Land',            // Default or add selector
                createdAt: new Date().toISOString()
            });
            alert('Historical Deployment Created');
            e.target.reset();
            loadData();
        } catch (error) {
            console.error(error);
            alert('Failed to create deployment');
        }
    };

    const handleImportFlights = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedImportDeployment) {
            alert("Please select a file and a target deployment.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = new Uint8Array(evt.target.result);
                const wb = XLSX.read(bstr, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Find Header (Flights)
                let headerIdx = -1;
                for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
                    const r = jsonData[i];
                    if (!Array.isArray(r)) continue;
                    const s = r.map(c => String(c).toLowerCase()).join(' ');
                    if (s.includes('date') && (s.includes('mission') || s.includes('msn') || s.includes('aircraft'))) {
                        headerIdx = i;
                        break;
                    }
                }

                if (headerIdx === -1) {
                    alert('Could not find Flight data header (Date, Mission, Aircraft...) in first 25 rows.');
                    return;
                }

                const headers = jsonData[headerIdx].map(h => String(h).trim().toLowerCase());
                const rows = jsonData.slice(headerIdx + 1);

                const getIdx = (patterns) => {
                    if (!Array.isArray(patterns)) patterns = [patterns];
                    return headers.findIndex(h => patterns.some(p => h.includes(p)));
                };

                const colDate = getIdx('date');
                const colMsn = getIdx(['mission', 'msn']);
                const colTail = getIdx(['aircraft', 'tail']);
                const colHrs = getIdx(['hours', 'hrs', 'time']);
                const colCancel = getIdx(['cancel', 'status', 'remark', 'code']);

                if (colDate === -1 || colMsn === -1) {
                    alert(`Found header row but missing Date or Mission column. Found: ${headers.join(', ')}`);
                    return;
                }

                const items = rows.map((row, i) => {
                    if (!row[colDate] && !row[colMsn]) return null;

                    // Parse Date helper
                    const parseDate = (val) => {
                        if (!val) return new Date().toISOString().split('T')[0];
                        if (typeof val === 'number') {
                            return new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0];
                        }
                        return String(val).trim();
                    };

                    const cancelVal = colCancel !== -1 ? row[colCancel] : null;
                    let status = 'Complete';
                    let reason = '';

                    if (cancelVal) {
                        const s = String(cancelVal).trim().toLowerCase();
                        if (!['', 'n/a', 'na', '-', 'null', 'none'].includes(s)) {
                            status = 'CNX';
                            reason = String(cancelVal).trim();
                        }
                    }

                    return {
                        deploymentId: parseInt(selectedImportDeployment),
                        date: parseDate(row[colDate]),
                        missionNumber: String(row[colMsn]),
                        aircraftNumber: colTail !== -1 ? String(row[colTail] || '') : '',
                        flightHours: colHrs !== -1 ? (parseFloat(row[colHrs]) || 0) : 0,
                        status,
                        reasonForDelay: reason,
                        createdAt: new Date().toISOString()
                    };
                }).filter(Boolean);

                if (items.length === 0) {
                    alert('No valid flight records found (checked Date/Mission columns).');
                    return;
                }

                await db.flights.bulkAdd(items);
                alert(`Imported ${items.length} flight records.`);
                e.target.value = null;

            } catch (err) {
                console.error(err);
                alert("Import failed: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImportParts = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedImportDeployment) {
            alert("Please select a file and a target deployment.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = new Uint8Array(evt.target.result);
                const wb = XLSX.read(bstr, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Find Header
                let headerIdx = -1;
                for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
                    const r = jsonData[i];
                    if (!Array.isArray(r)) continue;
                    const s = r.map(c => String(c).toLowerCase()).join(' ');
                    const hasPart = s.includes('part') || s.includes('p/n') || s.includes('item');
                    const hasDesc = s.includes('desc') || s.includes('title') || s.includes('name');
                    if (hasPart && hasDesc) {
                        headerIdx = i;
                        break;
                    }
                }

                if (headerIdx === -1) {
                    alert('Could not find Parts header (Part No, Description...) in first 25 rows.');
                    return;
                }

                const headers = jsonData[headerIdx].map(h => String(h).trim().toLowerCase());
                const rows = jsonData.slice(headerIdx + 1);

                const getIdx = (patterns) => {
                    if (!Array.isArray(patterns)) patterns = [patterns];
                    return headers.findIndex(h => patterns.some(p => h.includes(p)));
                };

                const colDate = getIdx('date');
                const colPart = getIdx(['part no', 'part #', 'p/n', 'part number', 'item']);
                const colDesc = getIdx(['desc', 'title', 'name']);
                const colQty = getIdx(['qty', 'quantity', 'count']);
                const colType = getIdx(['type', 'category']);

                if (colPart === -1) {
                    alert(`Found header row but missing Part Number column. Found: ${headers.join(', ')}`);
                    return;
                }

                const items = rows.map((row, i) => {
                    let partVal = (row[colPart] !== undefined && row[colPart] !== null) ? String(row[colPart]).trim() : '';

                    if (!partVal) {
                        if (!Array.isArray(row)) return null;
                        const hasContent = row.some(c => c !== null && c !== undefined && String(c).trim() !== '');
                        if (!hasContent) return null;
                        partVal = `UNKNOWN_PART_ROW_${i + 1}`;
                    }

                    const parseDate = (val) => {
                        if (!val) return new Date().toISOString().split('T')[0];
                        if (typeof val === 'number') {
                            return new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0];
                        }
                        return String(val).trim();
                    };

                    return {
                        deploymentId: parseInt(selectedImportDeployment),
                        date: colDate !== -1 ? parseDate(row[colDate]) : new Date().toISOString().split('T')[0],
                        partNumber: partVal,
                        quantity: colQty !== -1 ? (parseInt(row[colQty]) || 1) : 1,
                        type: colType !== -1 ? (row[colType] || 'Unscheduled') : 'Unscheduled',
                        description: colDesc !== -1 ? (row[colDesc] || '') : '',
                        createdAt: new Date().toISOString()
                    };
                }).filter(Boolean);

                if (items.length === 0) {
                    alert('No valid parts usage records found.');
                    return;
                }

                await db.partsUtilization.bulkAdd(items);
                alert(`Imported ${items.length} usage records.`);
                e.target.value = null;

            } catch (err) {
                console.error(err);
                alert("Import failed: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDeleteKey = async (id) => {
        if (confirm('Delete this key permanently?')) {
            await db.apiKeys.delete(id);
            loadData();
        }
    };

    if (loading) return <div className="p-8 text-center">Loading admin settings...</div>;

    // Check if user is actually admin (double check)
    // Note: This UI protection is shallow. Real protection is in the AuthContext/Database rules.
    const isAdmin = roles.includes('Sitrep.Admin');

    if (!isAdmin) {
        return <div className="p-8 text-center text-error">Access Denied</div>;
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Shield className="text-primary" />
                Administration
            </h1>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card bg-bg-secondary border-l-4 border-l-primary p-4 flex items-center justify-between">
                    <div>
                        <div className="text-secondary text-sm">Registered Users</div>
                        <div className="text-2xl font-bold">{users.length}</div>
                    </div>
                    <UserPlus className="text-primary opacity-50" size={32} />
                </div>
                {accessRequests.length > 0 && (
                    <div className="card bg-bg-secondary border-l-4 border-l-warning p-4 flex items-center justify-between">
                        <div>
                            <div className="text-secondary text-sm">Pending Requests</div>
                            <div className="text-2xl font-bold text-warning">{accessRequests.length}</div>
                        </div>
                        <AlertTriangle className="text-warning opacity-50" size={32} />
                    </div>
                )}
                <div className="card bg-bg-secondary border-l-4 border-l-info p-4 flex items-center justify-between">
                    <div>
                        <div className="text-secondary text-sm">System Status</div>
                        <div className="text-2xl font-bold text-success">Healthy</div>
                    </div>
                    <Database className="text-info opacity-50" size={32} />
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tabs tabs-boxed mb-6 bg-transparent p-0 gap-2">
                <button
                    className={`tab tab-lg ${activeTab === 'admin' ? 'tab-active btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('admin')}
                >
                    User Management
                </button>
                <button
                    className={`tab tab-lg ${activeTab === 'developer' ? 'tab-active btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('developer')}
                >
                    Developer & System
                </button>
                <button
                    className={`tab tab-lg ${activeTab === 'imports' ? 'tab-active btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('imports')}
                >
                    Data Imports
                </button>
            </div>

            {activeTab === 'admin' && (
                <>
                    {/* Access Requests Table */}
                    {accessRequests.length > 0 && (
                        <div className="card shadow-lg border border-warning/20 mb-8">
                            {/* ... (existing requests table content kept same, implied context) ... */}
                            <div className="card-header flex justify-between items-center bg-warning/5 px-6 py-4">
                                <h2 className="card-title text-warning flex items-center gap-2">
                                    <AlertTriangle size={20} />
                                    Access Requests ({accessRequests.length})
                                </h2>
                            </div>
                            <div className="card-body p-0">
                                <table className="table w-full">
                                    <thead className="bg-bg-tertiary">
                                        <tr>
                                            <th className="px-6 py-3 text-left">Name</th>
                                            <th className="px-6 py-3 text-left">Email</th>
                                            <th className="px-6 py-3 text-left">Reason</th>
                                            <th className="px-6 py-3 text-left">Date</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accessRequests.map(req => (
                                            <tr key={req.id} className="border-t border-border hover:bg-bg-tertiary/50">
                                                <td className="px-6 py-4 font-medium">{req.name}</td>
                                                <td className="px-6 py-4 text-muted">{req.email}</td>
                                                <td className="px-6 py-4 max-w-xs truncate">{req.reason}</td>
                                                <td className="px-6 py-4 text-sm text-muted">
                                                    {format(new Date(req.requestedAt), 'MMM dd, HH:mm')}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApproveRequest(req)}
                                                        className="btn btn-success btn-sm"
                                                    >
                                                        <Check className="mr-1" size={14} /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleDenyRequest(req)}
                                                        className="btn btn-error btn-sm"
                                                    >
                                                        <X className="mr-1" size={14} /> Deny
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* User List and Form */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Add/Edit User Form */}
                        <div className="card shadow-lg h-fit">
                            <div className="card-header">
                                <h2 className="card-title flex items-center gap-2">
                                    {editingUser ? <Pencil size={20} /> : <UserPlus size={20} />}
                                    {editingUser ? 'Edit User' : 'Add New User'}
                                </h2>
                            </div>
                            <div className="card-body">
                                <form onSubmit={handleSaveUser}>
                                    <div className="form-control mb-4">
                                        <label className="label">
                                            <span className="label-text">Email Address</span>
                                        </label>
                                        <input
                                            type="email"
                                            className="input input-bordered w-full"
                                            value={newUserEmail}
                                            onChange={(e) => setNewUserEmail(e.target.value)}
                                            placeholder="user@example.com"
                                            disabled={!!editingUser} // Can't edit email of existing
                                            required
                                        />
                                    </div>
                                    <div className="form-control mb-4">
                                        <label className="label">
                                            <span className="label-text">Role</span>
                                        </label>
                                        <select
                                            className="select select-bordered w-full"
                                            value={newUserRole}
                                            onChange={(e) => setNewUserRole(e.target.value)}
                                        >
                                            <option value="Sitrep.Reader">Reader (Read Only)</option>
                                            <option value="Sitrep.Editor">Editor (Can Edit)</option>
                                            <option value="Sitrep.Admin">Admin (Full Access)</option>
                                        </select>
                                    </div>

                                    {/* Deployment Assignment */}
                                    <div className="form-control mb-6">
                                        <label className="label">
                                            <span className="label-text">Assigned Deployments</span>
                                        </label>
                                        <div className="border border-border rounded-lg p-2 max-h-48 overflow-y-auto bg-bg-tertiary">
                                            {deployments.length === 0 ? (
                                                <div className="text-muted text-sm p-2">No active deployments.</div>
                                            ) : (
                                                deployments.map(dep => (
                                                    <label key={dep.id} className="flex items-center gap-2 p-2 hover:bg-bg-primary rounded cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="checkbox checkbox-sm checkbox-primary"
                                                            checked={selectedDeployments.includes(dep.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedDeployments(prev => [...prev, dep.id]);
                                                                } else {
                                                                    setSelectedDeployments(prev => prev.filter(id => id !== dep.id));
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-sm">{dep.name}</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                        <label className="label">
                                            <span className="label-text-alt text-muted text-xs">
                                                User will only see these deployments if they are not Admin.
                                            </span>
                                        </label>
                                    </div>

                                    <div className="flex gap-2">
                                        {editingUser && (
                                            <button type="button" className="btn btn-ghost flex-1" onClick={cancelEdit}>
                                                Cancel
                                            </button>
                                        )}
                                        <button type="submit" className="btn btn-primary flex-1">
                                            {editingUser ? 'Update User' : 'Add User'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Users List */}
                        <div className="card shadow-lg lg:col-span-2">
                            <div className="card-header">
                                <h2 className="card-title">Authorized Users</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="table w-full">
                                    <thead>
                                        <tr>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Added By</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.id} className="hover">
                                                <td className="font-medium">{u.email}</td>
                                                <td>
                                                    <span className={`badge ${u.role === 'Sitrep.Admin' ? 'badge-primary' : 'badge-ghost'}`}>
                                                        {u.role.replace('Sitrep.', '')}
                                                    </span>
                                                    {u.mustChangePassword && <span className="badge badge-warning ml-2 text-xs">Reset</span>}
                                                </td>
                                                <td className="text-muted text-sm">{u.addedBy || 'System'}</td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            className="btn btn-ghost btn-square btn-sm text-warning"
                                                            onClick={() => handleResetPassword(u.id)}
                                                            title="Reset Password"
                                                        >
                                                            <Key size={16} />
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-square btn-sm"
                                                            onClick={() => startEdit(u)}
                                                            title="Edit User"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-square btn-sm text-error"
                                                            onClick={() => handleDeleteUser(u.id)}
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {users.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center py-8 text-muted">No users found. Login with 'admin' / 'admin' to bootstrap.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Data Import Tab */}
            {activeTab === 'imports' && (
                <div className="space-y-8 animate-in fade-in">
                    {/* 1. Historical Deployment */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title text-primary flex items-center gap-2">
                                <Plus size={20} />
                                Add Historical Deployment
                            </h3>
                        </div>
                        <div className="card-body">
                            <p className="text-muted mb-4">Create a record for a completed deployment to associate historical data with.</p>
                            <form onSubmit={handleHistoricalDeployment} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="form-control">
                                    <label className="label text-xs">Name</label>
                                    <input name="name" className="input input-sm" placeholder="e.g. FY23 Q1 Deployment" required />
                                </div>
                                <div className="form-control">
                                    <label className="label text-xs">Location</label>
                                    <input name="location" className="input input-sm" placeholder="e.g. Site Alpha" required />
                                </div>
                                <div className="form-control">
                                    <label className="label text-xs">Start Date</label>
                                    <input name="startDate" type="date" className="input input-sm" required />
                                </div>
                                <button type="submit" className="btn btn-primary btn-sm">Create Record</button>
                            </form>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 2. Flight Logs Import */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title flex items-center gap-2">
                                    <Upload size={20} /> Import Flight Logs
                                </h3>
                            </div>
                            <div className="card-body">
                                <p className="text-sm text-muted mb-4">
                                    Upload an Excel file containing flight history.
                                </p>
                                <div className="alert bg-bg-tertiary mb-4 p-3 text-xs">
                                    <span className="font-bold block mb-1">Required Columns:</span>
                                    Date, Mission Number, Aircraft, Flight Hours, Cancellation Criteria (Optional)
                                </div>
                                <div className="flex flex-col gap-3">
                                    <select
                                        className="select select-bordered select-sm w-full"
                                        onChange={(e) => setSelectedImportDeployment(e.target.value)}
                                        value={selectedImportDeployment}
                                    >
                                        <option value="">Select Target Deployment...</option>
                                        {deployments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                                        ))}
                                    </select>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="file-input file-input-bordered file-input-sm w-full"
                                        onChange={(e) => handleImportFlights(e)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Parts Utilization Import */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title flex items-center gap-2">
                                    <Wrench size={20} /> Import Parts Usage
                                </h3>
                            </div>
                            <div className="card-body">
                                <p className="text-sm text-muted mb-4">
                                    Upload an Excel file containing parts usage history.
                                </p>
                                <div className="alert bg-bg-tertiary mb-4 p-3 text-xs">
                                    <span className="font-bold block mb-1">Required Columns:</span>
                                    Date, Part Number, Quantity, Type (Scheduled/Unscheduled)
                                </div>
                                <div className="flex flex-col gap-3">
                                    <select
                                        className="select select-bordered select-sm w-full"
                                        onChange={(e) => setSelectedImportDeployment(e.target.value)}
                                        value={selectedImportDeployment}
                                    >
                                        <option value="">Select Target Deployment...</option>
                                        {deployments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                                        ))}
                                    </select>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="file-input file-input-bordered file-input-sm w-full"
                                        onChange={(e) => handleImportParts(e)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Developer Content */}
            {activeTab === 'developer' && (
                <div className="space-y-8">
                    {/* Setup Guide */}
                    <div className="card">
                        <div className="card-header border-b border-border">
                            <h3 className="card-title">API Setup Guide</h3>
                        </div>
                        <div className="card-body prose prose-invert max-w-none">
                            <p>
                                The SITREP API provides programmatic access to flight data, equipment status, and deployment logs.
                                Follow these steps to authenticate your application:
                            </p>
                            <ol>
                                <li>Generate an API Key in the <strong>Administration</strong> tab.</li>
                                <li>Include this key in the header of all your HTTP requests:
                                    <pre className="bg-bg-tertiary p-3 rounded mt-2">
                                        <code>X-API-Key: sk_your_api_key_here</code>
                                    </pre>
                                </li>
                                <li>Ensure the backend server is running.</li>
                                <li>Base URL for all requests: <code className="text-accent-primary">{import.meta.env.VITE_API_URL || 'http://localhost:3001'}/v1</code></li>
                            </ol>
                        </div>
                    </div>

                    {/* Endpoints */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">API Endpoints</h3>
                        </div>
                        <div className="card-body">

                            <div className="space-y-6">
                                {/* GET /flights */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="bg-bg-tertiary px-4 py-3 flex items-center gap-3 border-b border-border">
                                        <span className="badge badge-primary font-mono">GET</span>
                                        <code className="text-sm font-mono flex-1">/flights</code>
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm text-muted mb-3">Retrieve a list of flight records. Supports filtering by date and deployment.</p>
                                        <h4 className="text-xs font-bold uppercase text-muted mb-2">Query Parameters</h4>
                                        <div className="grid grid-cols-[120px_1fr] gap-2 text-sm mb-4">
                                            <code className="text-accent-primary">startDate</code>
                                            <span>ISO 8601 Date (YYYY-MM-DD)</span>
                                            <code className="text-accent-primary">endDate</code>
                                            <span>ISO 8601 Date (YYYY-MM-DD)</span>
                                            <code className="text-accent-primary">deploymentId</code>
                                            <span>Integer ID of the deployment</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
