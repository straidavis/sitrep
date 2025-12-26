import React, { useState } from 'react';
import { Save, Database, Trash2, RefreshCw } from 'lucide-react';
import { seedDatabase } from '../db/seed';
import { db } from '../db/schema';

const Settings = () => {
    const [seeding, setSeeding] = useState(false);

    const handleSeed = async () => {
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
        if (!confirm('WARNING: This will delete ALL data (Flights, Equipment, Deployments). This cannot be undone. Are you sure?')) return;

        try {
            await db.flights.clear();
            await db.equipment.clear();
            await db.deployments.clear();
            alert('All data cleared successfully');
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Failed to clear data');
        }
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
                            Manage your local database. You can populate the database with initial data from the Excel file or clear all data to start fresh.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleSeed}
                                disabled={seeding}
                                style={{ justifyContent: 'center' }}
                            >
                                {seeding ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : <RefreshCw size={18} />}
                                Populate from InitialData.xlsx
                            </button>

                            <button
                                className="btn btn-danger"
                                onClick={handleClearData}
                                style={{ justifyContent: 'center' }}
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
                                <span className="font-semibold">Development</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-secondary">Storage</span>
                                <span className="font-semibold">IndexedDB (Local)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
