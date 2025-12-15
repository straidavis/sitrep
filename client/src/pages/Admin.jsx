import React, { useState, useEffect } from 'react';
import { db } from '../db/schema';
import { useAuth } from '../context/AuthContext';
import { Trash2, UserPlus, Key, Shield, AlertTriangle, Database, Download, Upload, Pencil, X } from 'lucide-react';
import { format } from 'date-fns';

const Admin = () => {
    const { user, roles } = useAuth();
    const [users, setUsers] = useState([]);
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
    const [deployments, setDeployments] = useState([]);
    const [selectedDeployments, setSelectedDeployments] = useState([]);

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
            const loadedKeys = await db.apiKeys.toArray();
            const loadedDeployments = await db.deployments.toArray();
            setUsers(loadedUsers);
            setApiKeys(loadedKeys);
            setDeployments(loadedDeployments.filter(d => d.status === 'Active' || d.status === 'Planning'));
        } catch (error) {
            console.error('Error loading admin data', error);
        } finally {
            setLoading(false);
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

    const handleSaveUser = async (e) => {
        e.preventDefault();
        if (!newUserEmail) return;

        try {
            await db.transaction('rw', db.users, db.deployments, async () => {

                if (editingUser) {
                    // UPDATE EXISTING
                    await db.users.update(editingUser.id, {
                        role: newUserRole,
                        // Email is usually constant, but if changed we'd need to migrate. 
                        // For simplicity, we assume email matches for now or we prevent editing email in UI.
                    });
                } else {
                    // CREATE NEW
                    // Check if exists first
                    const existing = await db.users.where('email').equals(newUserEmail).first();
                    if (existing) {
                        alert('User already exists');
                        return;
                    }

                    await db.users.add({
                        email: newUserEmail,
                        role: newUserRole,
                        addedBy: user?.username || 'Unknown',
                        createdAt: new Date().toISOString()
                    });
                }

                // SYNC DEPLOYMENTS (Add to selected, Remove from unselected)
                // We iterate ALL loaded deployments (active/planning) to ensure state is consistent
                for (const dep of deployments) {
                    const shouldBeAssigned = selectedDeployments.includes(dep.id);

                    // Get current email list safely
                    let currentEmails = dep.userEmails
                        ? (Array.isArray(dep.userEmails) ? [...dep.userEmails] : String(dep.userEmails).split(',').map(e => e.trim()).filter(e => e))
                        : [];

                    const hasEmail = currentEmails.includes(newUserEmail);
                    let changed = false;

                    if (shouldBeAssigned && !hasEmail) {
                        currentEmails.push(newUserEmail);
                        changed = true;
                    } else if (!shouldBeAssigned && hasEmail) {
                        currentEmails = currentEmails.filter(e => e !== newUserEmail);
                        changed = true;
                    }

                    if (changed) {
                        await db.deployments.update(dep.id, { userEmails: currentEmails });
                    }
                }
            });

            cancelEdit();
            loadData();
        } catch (error) {
            console.error('Failed to save user', error);
            alert('Error saving user data.');
        }
    };

    const toggleDeploymentSelection = (id) => {
        if (selectedDeployments.includes(id)) {
            setSelectedDeployments(selectedDeployments.filter(d => d !== id));
        } else {
            setSelectedDeployments([...selectedDeployments, id]);
        }
    };

    const handleRemoveUser = async (id) => {
        if (confirm('Are you sure you want to remove this user permission?')) {
            await db.users.delete(id);
            loadData();
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

    const handleDeleteKey = async (id) => {
        if (confirm('Delete this key permanently?')) {
            await db.apiKeys.delete(id);
            loadData();
        }
    };

    if (loading) return <div className="p-8 text-center">Loading admin settings...</div>;

    // Check if user is actually admin (double check)
    // Note: This UI protection is shallow. Real protection is in the AuthContext/Database rules.
    const isAdmin = roles?.includes('Sitrep.Admin');

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-20 text-center">
                <Shield size={64} className="text-error mb-4" />
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-muted">You do not have permission to view the Admin Portal.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-20">
            {/* Tabs & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="page-title flex items-center gap-3">
                        <Shield className="text-primary" />
                        Admin Portal
                    </h1>
                    <p className="page-description">Manage user permissions, data backups, and API keys.</p>
                </div>

                <div className="bg-bg-tertiary p-1 rounded-lg inline-flex border border-border">
                    <button
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'admin' ? 'bg-bg-primary shadow-sm text-accent-primary' : 'text-muted hover:text-text-primary'}`}
                        onClick={() => setActiveTab('admin')}
                    >
                        <Shield size={14} />
                        Administration
                    </button>
                    <button
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'developer' ? 'bg-bg-primary shadow-sm text-accent-primary' : 'text-muted hover:text-text-primary'}`}
                        onClick={() => setActiveTab('developer')}
                    >
                        <Key size={14} />
                        Developer API
                    </button>
                </div>
            </div>

            {/* Admin Content */}
            {activeTab === 'admin' && (
                <>
                    {/* User Permissions Section */}
                    <div className="card mb-8">
                        <div className="card-header border-b border-border">
                            <h3 className="card-title flex items-center gap-2 text-base">
                                <UserPlus size={18} />
                                User Permissions
                            </h3>
                        </div>
                        <div className="card-body">
                            {/* Add/Edit User Form */}
                            <form onSubmit={handleSaveUser} className={`rounded-lg p-5 mb-6 border ${editingUser ? 'bg-primary/5 border-primary/20' : 'bg-bg-tertiary/50 border-border'}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="card-title text-sm uppercase tracking-wide text-muted">
                                        {editingUser ? 'Edit User' : 'Add New User'}
                                    </h4>
                                    {editingUser && (
                                        <button type="button" onClick={cancelEdit} className="text-xs flex items-center gap-1 text-muted hover:text-text-primary transition-colors">
                                            <X size={14} /> Cancel Edit
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-5">
                                        <label className="form-label text-xs font-semibold uppercase text-muted mb-1.5 block">Email Address</label>
                                        <input
                                            type="email"
                                            className="input w-full h-9 text-sm"
                                            placeholder="user@company.com"
                                            value={newUserEmail}
                                            onChange={e => setNewUserEmail(e.target.value)}
                                            required
                                            disabled={!!editingUser}
                                            title={editingUser ? "To change email, remove and add new user." : ""}
                                        />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="form-label text-xs font-semibold uppercase text-muted mb-1.5 block">Role</label>
                                        <select
                                            className="select w-full h-9 text-sm"
                                            value={newUserRole}
                                            onChange={e => setNewUserRole(e.target.value)}
                                        >
                                            <option value="Sitrep.Editor">Editor (Can edit data)</option>
                                            <option value="Sitrep.Deployer">Deployer (Restricted access)</option>
                                            <option value="Sitrep.Admin">Admin (Full Access)</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-3">
                                        <button type="submit" className={`btn btn-sm w-full h-9 ${editingUser ? 'btn-success' : 'btn-primary'}`}>
                                            {editingUser ? 'Save Changes' : 'Add User'}
                                        </button>
                                    </div>
                                </div>

                                {/* Deployment Selection for Deployers */}
                                {newUserRole === 'Sitrep.Deployer' && (
                                    <div className="mt-4 pt-4 border-t border-border/50 animate-in fade-in zoom-in-95 duration-200">
                                        <label className="form-label text-xs font-semibold uppercase text-accent-primary mb-2 block">Assigned Deployments</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto bg-bg-primary/50 p-2 rounded border border-border/50">
                                            {deployments.map(d => (
                                                <label key={d.id} className="flex items-center gap-2.5 p-2 rounded hover:bg-bg-elevated cursor-pointer select-none transition-colors border border-transparent hover:border-border/50">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDeployments.includes(d.id)}
                                                        onChange={() => toggleDeploymentSelection(d.id)}
                                                        className="checkbox w-4 h-4 rounded-sm"
                                                    />
                                                    <span className="text-sm truncate leading-none pt-0.5">{d.name || d.location}</span>
                                                </label>
                                            ))}
                                            {deployments.length === 0 && <span className="text-sm text-muted italic p-2">No active deployments found.</span>}
                                        </div>
                                    </div>
                                )}
                            </form>

                            {/* User List */}
                            <div className="overflow-hidden border border-border rounded-lg shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-bg-tertiary border-b border-border">
                                            <th className="py-2.5 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Email</th>
                                            <th className="py-2.5 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Role</th>
                                            <th className="py-2.5 px-4 text-xs font-semibold text-muted uppercase tracking-wider">Date Added</th>
                                            <th className="py-2.5 px-4 text-xs font-semibold text-muted uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {Array.isArray(users) && users.length > 0 ? users.map(u => (
                                            <tr key={u.id} className={`group hover:bg-bg-tertiary/30 transition-colors ${editingUser?.id === u.id ? 'bg-primary/5' : ''}`}>
                                                <td className="py-2.5 px-4 text-sm font-medium">{u.email}</td>
                                                <td className="py-2.5 px-4">
                                                    <span className={`badge text-xs px-2 py-0.5 ${u.role === 'Sitrep.Admin' ? 'badge-primary' : (u.role === 'Sitrep.Deployer' ? 'badge-info' : 'badge-secondary')}`}>
                                                        {u.role.replace('Sitrep.', '')}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 text-sm text-muted">{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                                                <td className="py-2.5 px-4 text-right flex justify-end gap-1">
                                                    <button
                                                        onClick={() => startEdit(u)}
                                                        className="p-1 rounded hover:bg-bg-tertiary text-muted hover:text-accent-primary transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveUser(u.id)}
                                                        className="p-1 rounded hover:bg-bg-tertiary text-muted hover:text-error transition-colors"
                                                        title="Remove"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" className="py-8 text-center text-muted text-sm italic">No custom permissions found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Database Management Section */}
                    <div className="card mb-8">
                        <div className="card-body py-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <h3 className="text-base font-semibold flex items-center gap-2 mb-1">
                                    <Database size={18} className="text-muted" />
                                    System Backup
                                </h3>
                                <p className="text-xs text-muted max-w-lg">
                                    Export your local database to a JSON file for safekeeping, or restore data from a previous backup.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={handleBackup} className="btn btn-sm btn-secondary flex items-center gap-2">
                                    <Download size={14} />
                                    Backup
                                </button>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".json"
                                    onChange={handleRestore}
                                    className="hidden"
                                />
                                <button
                                    onClick={handleRestoreTrigger}
                                    className="btn btn-sm btn-outline hover:btn-danger flex items-center gap-2 transition-all"
                                >
                                    <Upload size={14} />
                                    Restore
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* REST API Keys Section */}
                    <div className="card">
                        <div className="card-header border-b border-border">
                            <h3 className="card-title flex items-center gap-2">
                                <Key size={20} />
                                REST API Keys
                            </h3>
                            <p className="text-sm text-muted mt-1">
                                Create keys to allow external applications to access the backend SQL database securely.
                            </p>
                        </div>
                        <div className="card-body">
                            {/* New Key Form */}
                            <form onSubmit={generateApiKey} className="flex gap-4 mb-6 items-end p-5 bg-bg-tertiary/50 border border-border rounded-lg">
                                <div className="flex-1">
                                    <label className="form-label text-xs font-semibold uppercase text-muted mb-1.5 block">Key Name / Description</label>
                                    <input
                                        type="text"
                                        className="input w-full h-9 text-sm"
                                        placeholder="e.g. PowerBI Connector"
                                        value={newKeyName}
                                        onChange={e => setNewKeyName(e.target.value)}
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn btn-sm btn-primary h-9">
                                    Generate Key
                                </button>
                            </form>

                            {/* Generated Key Display */}
                            {generatedKey && (
                                <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="text-green-500 mt-1 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-green-500 mb-1">New Key Generated</h4>
                                        <p className="text-sm mb-2">Copy this key now. You will not be able to see it again.</p>
                                        <code className="block bg-black/30 p-2 rounded font-mono text-lg break-all select-all">
                                            {generatedKey}
                                        </code>
                                    </div>
                                </div>
                            )}

                            {/* Keys List */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border text-sm text-muted">
                                            <th className="py-2 px-4">Name</th>
                                            <th className="py-2 px-4">Prefix</th>
                                            <th className="py-2 px-4">Status</th>
                                            <th className="py-2 px-4">Created</th>
                                            <th className="py-2 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(apiKeys) && apiKeys.length > 0 ? apiKeys.map(k => (
                                            <tr key={k.id} className="border-b border-border hover:bg-tertiary">
                                                <td className="py-3 px-4 font-medium">{k.name}</td>
                                                <td className="py-3 px-4 font-mono text-sm text-muted">{k.key.substr(0, 8)}...</td>
                                                <td className="py-3 px-4">
                                                    <span className={`badge ${k.status === 'Active' ? 'badge-success' : 'badge-error'}`}>
                                                        {k.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-muted">{format(new Date(k.createdAt), 'MMM d, yyyy')}</td>
                                                <td className="py-3 px-4 text-right flex justify-end gap-2">
                                                    {k.status === 'Active' && (
                                                        <button
                                                            onClick={() => handleRevokeKey(k.id)}
                                                            className="btn-sm btn-secondary hover:text-warning"
                                                            title="Revoke Key"
                                                        >
                                                            Revoke
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteKey(k.id)}
                                                        className="btn-icon text-muted hover:text-error"
                                                        title="Delete Key"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" className="py-8 text-center text-muted">No API keys generated.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
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
                                        <h4 className="text-xs font-bold uppercase text-muted mb-2">Response Example</h4>
                                        <pre className="bg-black/30 p-3 rounded text-xs font-mono text-muted">
                                            {`[
  {
    "id": 101,
    "missionNumber": "251212_V-BAT-128",
    "date": "2025-12-12T10:00:00Z",
    "aircraftNumber": "V-BAT 128",
    "duration": 4.5,
    "status": "Complete"
  }
]`}
                                        </pre>
                                    </div>
                                </div>

                                {/* GET /equipment */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="bg-bg-tertiary px-4 py-3 flex items-center gap-3 border-b border-border">
                                        <span className="badge badge-primary font-mono">GET</span>
                                        <code className="text-sm font-mono flex-1">/equipment</code>
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm text-muted mb-3">Get current status of all equipment.</p>
                                        <h4 className="text-xs font-bold uppercase text-muted mb-2">Response Example</h4>
                                        <pre className="bg-black/30 p-3 rounded text-xs font-mono text-muted">
                                            {`[
  {
    "id": 5,
    "category": "Aircraft",
    "equipment": "V-BAT 128",
    "serialNumber": "SN-12345",
    "status": "FMC",
    "location": "Cutter Midgett"
  }
]`}
                                        </pre>
                                    </div>
                                </div>

                                {/* POST /flights */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="bg-bg-tertiary px-4 py-3 flex items-center gap-3 border-b border-border">
                                        <span className="badge badge-success font-mono">POST</span>
                                        <code className="text-sm font-mono flex-1">/flights</code>
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm text-muted mb-3">Log a new flight record.</p>
                                        <h4 className="text-xs font-bold uppercase text-muted mb-2">Request Body</h4>
                                        <pre className="bg-black/30 p-3 rounded text-xs font-mono text-muted">
                                            {`{
  "date": "2025-12-12",
  "aircraftNumber": "SN-12345",
  "deploymentId": 2,
  "launchTime": "10:00",
  "recoveryTime": "14:30"
}`}
                                        </pre>
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
