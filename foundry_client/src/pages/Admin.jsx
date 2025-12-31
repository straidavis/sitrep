import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import { Trash2, UserPlus, Key, Shield, AlertTriangle, Database, Download, Upload, Pencil, X, Check, Plus, Wrench, Plane } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

import { config } from '../config';
import { getAllUsers, addUser, updateUser, deleteUser, getUserByEmail } from '../db/users';
import { getAllAccessRequests, updateAccessRequest } from '../db/accessRequests';

import { getAllDeployments, updateDeployment, addDeployment } from '../db/deployments';
import { foundryService } from '../services/foundryService'; // Direct access for bulk imports

const Admin = () => {
    const { user, roles } = useAuth();
    const { deployments, refreshDeployments, setSelectedDeploymentIds } = useDeployment();
    const [users, setUsers] = useState([]);
    const [accessRequests, setAccessRequests] = useState([]);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('App.User');

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('admin'); // 'admin', 'developer', 'imports'

    // Deployment assignment state
    const [selectedDeployments, setSelectedDeployments] = useState([]);

    // Import State
    const [selectedImportDeployment, setSelectedImportDeployment] = useState('');

    // Edit Mode State
    const [editingUser, setEditingUser] = useState(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [loadedUsers, loadedRequests] = await Promise.all([
                getAllUsers(),
                getAllAccessRequests()
            ]);

            setUsers(loadedUsers);
            setAccessRequests(loadedRequests.filter(r => r.status === 'Pending'));
        } catch (error) {
            console.error('Error loading admin data', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Access Requests ---
    const handleApproveRequest = async (request) => {
        try {
            // Add to users
            const existing = await getUserByEmail(request.email);
            if (!existing) {
                await addUser({
                    email: request.email,
                    role: 'App.User', // Default role for approved requests
                    addedBy: user.username,
                    createdAt: new Date().toISOString()
                });
            }
            // Update request status
            await updateAccessRequest(request.id, { status: 'Approved' });
            await loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to approve');
        }
    };

    const handleDenyRequest = async (request) => {
        try {
            await updateAccessRequest(request.id, { status: 'Denied' });
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
        setNewUserRole('App.User');
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
            const email = editingUser ? editingUser.email : newUserEmail;

            if (editingUser) {
                // UPDATE EXISTING
                await updateUser(editingUser.id, {
                    role: newUserRole,
                });
            } else {
                // CREATE NEW
                const existing = await getUserByEmail(newUserEmail);
                if (existing) {
                    alert('User already exists');
                    return;
                }

                tempPass = generateTempPassword(); // Generate temp password for new user

                await addUser({
                    email: newUserEmail,
                    role: newUserRole,
                    addedBy: user.username,
                    tempPassword: tempPass,
                    mustChangePassword: true,
                    createdAt: new Date().toISOString()
                });
            }

            // Update Deployments
            const allDeployments = await getAllDeployments();

            for (const d of allDeployments) {
                let emails = d.userEmails
                    ? (Array.isArray(d.userEmails) ? [...d.userEmails] : String(d.userEmails).split(',').map(e => e.trim()).filter(e => e))
                    : [];

                const shouldBeAssigned = selectedDeployments.includes(d.id);
                const isAssigned = emails.includes(email);

                if (shouldBeAssigned && !isAssigned) {
                    emails.push(email);
                    await updateDeployment(d.id, { userEmails: emails });
                } else if (!shouldBeAssigned && isAssigned) {
                    emails = emails.filter(e => e !== email);
                    await updateDeployment(d.id, { userEmails: emails });
                }
            }
            refreshDeployments(); // update context

            // Force Context Switch if self-assigning
            if (user && (user.username === newUserEmail || user.username === email)) {
                console.log("Self-assignment detected, switching context...", selectedDeployments);
                // Ensure we only select deployments that actually exist (sanity check)
                const validSelection = selectedDeployments.filter(id => allDeployments.some(d => d.id === id));
                if (validSelection.length > 0) {
                    setSelectedDeploymentIds(validSelection);
                }
            }

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
            await updateUser(userId, {
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
            await deleteUser(id);
            await loadData();
        } catch (error) {
            console.error(error);
            alert('Failed to delete user');
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
            await addDeployment({
                name,
                location,
                startDate,
                status: 'Completed',     // Historical
                type: 'Land',            // Default or add selector
                createdAt: new Date().toISOString()
            });
            alert('Historical Deployment Created');
            e.target.reset();
            refreshDeployments();
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

                // Bulk Add using FoundryService directly for efficiency
                await foundryService.writeDataset('flights', items, 'APPEND');

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

                // Bulk Add Parts Utilization
                await foundryService.writeDataset('parts_utilization', items, 'APPEND');

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
            await deleteApiKey(id);
            loadData();
        }
    };

    if (loading) return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span> Loading admin settings...</div>;

    const isAdmin = roles.includes('App.Admin');

    if (!isAdmin) {
        return <div className="p-8 text-center text-error border border-error rounded-lg m-8">Access Denied</div>;
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Shield className="text-primary" />
                Administration
            </h1>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card bg-base-100 shadow-sm border border-l-4 border-l-primary p-4 flex items-center justify-between">
                    <div>
                        <div className="text-muted text-sm">Registered Users</div>
                        <div className="text-2xl font-bold">{users.length}</div>
                    </div>
                    <UserPlus className="text-primary opacity-50" size={32} />
                </div>
                {accessRequests.length > 0 && (
                    <div className="card bg-base-100 shadow-sm border border-l-4 border-l-warning p-4 flex items-center justify-between">
                        <div>
                            <div className="text-muted text-sm">Pending Requests</div>
                            <div className="text-2xl font-bold text-warning">{accessRequests.length}</div>
                        </div>
                        <AlertTriangle className="text-warning opacity-50" size={32} />
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="tabs tabs-boxed bg-base-200 p-1 mb-6">
                <button
                    className={`tab ${activeTab === 'admin' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('admin')}
                >
                    User Management
                </button>
                <button
                    className={`tab ${activeTab === 'developer' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('developer')}
                >
                    Developer & System
                </button>
                <button
                    className={`tab ${activeTab === 'imports' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('imports')}
                >
                    Data Imports
                </button>
            </div>

            {activeTab === 'admin' && (
                <>
                    {/* Access Requests Table */}
                    {accessRequests.length > 0 && (
                        <div className="card bg-base-100 shadow-lg border border-warning/20 mb-8">
                            <div className="card-header flex justify-between items-center bg-warning/5 px-6 py-4">
                                <h2 className="card-title text-warning flex items-center gap-2">
                                    <AlertTriangle size={20} />
                                    Access Requests ({accessRequests.length})
                                </h2>
                            </div>
                            <div className="card-body p-0 overflow-x-auto">
                                <table className="table w-full">
                                    <thead className="bg-base-200">
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
                                            <tr key={req.id} className="border-t border-base-200 hover:bg-base-200/50">
                                                <td className="px-6 py-4 font-medium">{req.name}</td>
                                                <td className="px-6 py-4 text-muted">{req.email}</td>
                                                <td className="px-6 py-4 max-w-xs truncate">{req.reason}</td>
                                                <td className="px-6 py-4 text-sm text-muted">
                                                    {format(new Date(req.createdAt || req.requestedAt), 'MMM dd, HH:mm')}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApproveRequest(req)}
                                                        className="btn btn-success btn-xs gap-1"
                                                    >
                                                        <Check size={12} /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleDenyRequest(req)}
                                                        className="btn btn-error btn-xs gap-1"
                                                    >
                                                        <X size={12} /> Deny
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
                        <div className="card bg-base-100 shadow-lg h-fit">
                            <div className="card-body">
                                <h2 className="card-title flex items-center gap-2 mb-4">
                                    {editingUser ? <Pencil size={20} /> : <UserPlus size={20} />}
                                    {editingUser ? 'Edit User' : 'Add New User'}
                                </h2>
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
                                            <option value="">No Role (Read Only)</option>
                                            <option value="App.User">User (Edit Assigned)</option>
                                            <option value="App.Admin">Admin (Full Access)</option>
                                        </select>
                                    </div>

                                    {/* Deployment Assignment */}
                                    <div className="form-control mb-6">
                                        <label className="label">
                                            <span className="label-text">Assigned Deployments</span>
                                        </label>
                                        <div className="border border-base-300 rounded-lg p-2 max-h-48 overflow-y-auto bg-base-200/50">
                                            {deployments.length === 0 ? (
                                                <div className="text-muted text-sm p-2">No active deployments.</div>
                                            ) : (
                                                deployments.map(dep => (
                                                    <label key={dep.id} className="flex items-center gap-2 p-2 hover:bg-base-200 rounded cursor-pointer">
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
                        <div className="card bg-base-100 shadow-lg lg:col-span-2">
                            <div className="card-body">
                                <h2 className="card-title mb-4">Authorized Users</h2>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra w-full">
                                        <thead>
                                            <tr>
                                                <th>Email</th>
                                                <th>Role</th>
                                                <th>Assigned</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id}>
                                                    <td className="font-medium">{u.email}</td>
                                                    <td>
                                                        <span className={`badge ${u.role === 'App.Admin' ? 'badge-primary' : 'badge-ghost'}`}>
                                                            {(u.role || '').replace('App.', '')}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="flex flex-wrap gap-1">
                                                            {deployments
                                                                .filter(d => {
                                                                    const emails = Array.isArray(d.userEmails)
                                                                        ? d.userEmails
                                                                        : (d.userEmails ? String(d.userEmails).split(',') : []);
                                                                    return emails.some(e => e.trim().toLowerCase() === (u.email || '').toLowerCase());
                                                                })
                                                                .map(d => (
                                                                    <span key={d.id} className="badge badge-sm badge-outline">
                                                                        {d.name}
                                                                    </span>
                                                                ))
                                                            }
                                                        </div>
                                                    </td>
                                                    <td className="text-right flex justify-end gap-1">
                                                        <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => startEdit(u)}>
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button className="btn btn-ghost btn-xs text-warning" title="Reset Password" onClick={() => handleResetPassword(u.id)}>
                                                            <Key size={14} />
                                                        </button>
                                                        <button className="btn btn-ghost btn-xs text-error" title="Delete" onClick={() => handleDeleteUser(u.id)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'developer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">


                    {/* System Info */}
                    <div className="card bg-base-100 shadow-lg">
                        <div className="card-body">
                            <h2 className="card-title flex items-center gap-2">
                                <Database size={20} /> System Status
                            </h2>
                            <div className="stats stats-vertical shadow w-full mt-4">
                                <div className="stat">
                                    <div className="stat-title">Backend Connection</div>
                                    <div className="stat-value text-success text-lg">Connected (Foundry)</div>
                                    <div className="stat-desc">Using Foundry Service API</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title">Client Version</div>
                                    <div className="stat-value text-lg">v2.1.0</div>
                                    <div className="stat-desc">Build 2025.12.27</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'imports' && (
                <div className="space-y-6">
                    <div className="alert alert-info shadow-sm">
                        <Upload size={24} />
                        <div>
                            <h3 className="font-bold">Bulk Data Import</h3>
                            <div className="text-xs">Import historical data from Excel spreadsheets.</div>
                        </div>
                    </div>

                    <div className="card bg-base-100 shadow-lg p-6">
                        <div className="form-control max-w-md mb-6">
                            <label className="label font-bold">Select Target Deployment</label>
                            <select
                                className="select select-bordered"
                                value={selectedImportDeployment}
                                onChange={(e) => setSelectedImportDeployment(e.target.value)}
                            >
                                <option value="">-- Select Deployment --</option>
                                {deployments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Flights Import */}
                            <div className="border border-base-300 rounded-lg p-4">
                                <h3 className="font-bold mb-4 flex items-center gap-2">
                                    <Plane /> Import Flight Logs
                                </h3>
                                <p className="text-sm text-muted mb-4">
                                    Excel file must contain columns: Date, Mission/MSN, Aircraft/Tail, Hours.
                                </p>
                                <input
                                    type="file"
                                    className="file-input file-input-bordered w-full"
                                    accept=".xlsx, .xls"
                                    onChange={handleImportFlights}
                                    disabled={!selectedImportDeployment}
                                />
                            </div>

                            {/* Parts Import */}
                            <div className="border border-base-300 rounded-lg p-4">
                                <h3 className="font-bold mb-4 flex items-center gap-2">
                                    <Wrench /> Import Parts Utilization
                                </h3>
                                <p className="text-sm text-muted mb-4">
                                    Excel file must contain columns: Date, Part No, Description, Qty.
                                </p>
                                <input
                                    type="file"
                                    className="file-input file-input-bordered w-full"
                                    accept=".xlsx, .xls"
                                    onChange={handleImportParts}
                                    disabled={!selectedImportDeployment}
                                />
                            </div>
                        </div>

                        <div className="divider my-8">Historical Data</div>

                        <div className="w-full max-w-md">
                            <h3 className="font-bold mb-2">Create Historical Deployment Scope</h3>
                            <form onSubmit={handleHistoricalDeployment} className="space-y-4">
                                <input name="name" placeholder="Deployment Name (e.g. 2023 Pacific)" className="input input-bordered w-full" required />
                                <input name="location" placeholder="Location/Description" className="input input-bordered w-full" required />
                                <input name="startDate" type="date" className="input input-bordered w-full" required />
                                <button type="submit" className="btn btn-secondary w-full">Create Historical Scope</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};



export default Admin;
