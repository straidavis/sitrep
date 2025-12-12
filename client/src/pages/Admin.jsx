import React, { useState, useEffect } from 'react';
import { db } from '../db/schema';
import { useAuth } from '../context/AuthContext';
import { Trash2, UserPlus, Key, Shield, AlertTriangle } from 'lucide-react';
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

    // Initial Load
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const loadedUsers = await db.users.toArray();
            const loadedKeys = await db.apiKeys.toArray();
            setUsers(loadedUsers);
            setApiKeys(loadedKeys);
        } catch (error) {
            console.error('Error loading admin data', error);
        } finally {
            setLoading(false);
        }
    };

    // --- User Management ---
    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newUserEmail) return;

        try {
            await db.users.add({
                email: newUserEmail,
                role: newUserRole,
                addedBy: user?.username || 'Unknown',
                createdAt: new Date().toISOString()
            });
            setNewUserEmail('');
            loadData();
        } catch (error) {
            console.error('Failed to add user', error);
        }
    };

    const handleRemoveUser = async (id) => {
        if (confirm('Are you sure you want to remove this user permission?')) {
            await db.users.delete(id);
            loadData();
        }
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
            <div className="page-header">
                <h1 className="page-title flex items-center gap-3">
                    <Shield className="text-primary" />
                    Admin Portal
                </h1>
                <p className="page-description">Manage user permissions and API access.</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border mb-8">
                <button
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'admin' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text-primary'}`}
                    onClick={() => setActiveTab('admin')}
                >
                    <Shield size={16} />
                    Administration
                </button>
                <button
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'developer' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text-primary'}`}
                    onClick={() => setActiveTab('developer')}
                >
                    <Key size={16} />
                    Developer API
                </button>
            </div>

            {/* Admin Content */}
            {activeTab === 'admin' && (
                <>
                    {/* User Permissions Section */}
                    <div className="card mb-8">
                        <div className="card-header border-b border-border">
                            <h3 className="card-title flex items-center gap-2">
                                <UserPlus size={20} />
                                User Permissions
                            </h3>
                            <p className="text-sm text-muted mt-1">
                                By default, all authenticated users in your domain have <strong>Viewer</strong> access.
                                Add users here to grant them <strong>Editor</strong> or <strong>Admin</strong> privileges.
                            </p>
                        </div>
                        <div className="card-body">
                            {/* Add User Form */}
                            <form onSubmit={handleAddUser} className="flex gap-4 mb-6 items-end p-4 bg-secondary rounded-lg">
                                <div className="flex-1">
                                    <label className="form-label">User Email</label>
                                    <input
                                        type="email"
                                        className="input"
                                        placeholder="user@company.com"
                                        value={newUserEmail}
                                        onChange={e => setNewUserEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="w-48">
                                    <label className="form-label">Role</label>
                                    <select
                                        className="select"
                                        value={newUserRole}
                                        onChange={e => setNewUserRole(e.target.value)}
                                    >
                                        <option value="Sitrep.Editor">Editor</option>
                                        <option value="Sitrep.Admin">Admin</option>
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary">
                                    Add User
                                </button>
                            </form>

                            {/* User List */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border text-sm text-muted">
                                            <th className="py-2 px-4">Email</th>
                                            <th className="py-2 px-4">Role</th>
                                            <th className="py-2 px-4">Added By</th>
                                            <th className="py-2 px-4">Date</th>
                                            <th className="py-2 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(users) && users.length > 0 ? users.map(u => (
                                            <tr key={u.id} className="border-b border-border hover:bg-tertiary">
                                                <td className="py-3 px-4 font-medium">{u.email}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`badge ${u.role === 'Sitrep.Admin' ? 'badge-primary' : 'badge-secondary'}`}>
                                                        {u.role.replace('Sitrep.', '')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-muted">{u.addedBy}</td>
                                                <td className="py-3 px-4 text-sm text-muted">{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => handleRemoveUser(u.id)}
                                                        className="btn-icon text-muted hover:text-error"
                                                        title="Remove Permission"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" className="py-8 text-center text-muted">No custom permissions defined. Default domain rules apply.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
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
                            <form onSubmit={generateApiKey} className="flex gap-4 mb-6 items-end p-4 bg-secondary rounded-lg">
                                <div className="flex-1">
                                    <label className="form-label">Key Name / Description</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g. PowerBI Connector"
                                        value={newKeyName}
                                        onChange={e => setNewKeyName(e.target.value)}
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary">
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
