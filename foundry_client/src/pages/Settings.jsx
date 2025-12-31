import React, { useState } from 'react';
import { Save, Database, Trash2, RefreshCw, ShieldAlert } from 'lucide-react';
import { seedDatabase } from '../db/seed';
import { useAuth } from '../context/AuthContext';
// import { db } from '../db/schema'; // Removed for Foundry

const Settings = () => {
    const [seeding, setSeeding] = useState(false);
    const { roles } = useAuth();
    const isAdmin = roles && roles.includes('App.Admin');

    const handleSeed = async () => {
        if (!isAdmin) {
            alert("Administrative privileges required.");
            return;
        }
        if (!confirm('This will add initial data to your database. Continue?')) return;

        try {
            setSeeding(true);
            const result = await seedDatabase();
            if (result.success) {
                alert(result.message);
                window.location.reload(); // Reload to show new data
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to seed database');
        } finally {
            setSeeding(false);
        }
    };

    const handleClearData = async () => {
        alert("This feature is disabled for the Foundry backend to prevent accidental data loss.");
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-description">
                    Manage application settings and data
                </p>
            </div>

            <div className="grid grid-cols-2" style={{ gap: 'var(--spacing-lg)' }}>
                {/* Data Management */}
                <div className="card">
                    <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <Database size={20} />
                            <h3 className="card-title">Data Management</h3>
                        </div>
                    </div>
                    <div className="card-body">
                        <p className="text-muted" style={{ marginBottom: 'var(--spacing-md)' }}>
                            Manage your database. You can populate the database with initial demo data.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {isAdmin ? (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSeed}
                                    disabled={seeding}
                                    style={{ justifyContent: 'center' }}
                                >
                                    {seeding ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : <RefreshCw size={18} />}
                                    Populate from Demo Data
                                </button>
                            ) : (
                                <div className="alert alert-warning shadow-sm text-sm p-3">
                                    <div className="flex gap-2">
                                        <ShieldAlert size={16} />
                                        <span>Admin privileges required to manage data.</span>
                                    </div>
                                </div>
                            )}

                            <button
                                className="btn btn-secondary"
                                onClick={handleClearData}
                                style={{ justifyContent: 'center', opacity: 0.5, cursor: 'not-allowed' }}
                                title="Disabled in Foundry Mode"
                            >
                                <Trash2 size={18} />
                                Clear All Data
                            </button>
                        </div>
                    </div>
                </div>

                {/* App Info */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Application Info</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-secondary">Version</span>
                                <span className="font-semibold">1.0.0</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-secondary">Environment</span>
                                <span className="font-semibold">Foundry (Remote)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-secondary">Storage</span>
                                <span className="font-semibold">Foundry API</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
