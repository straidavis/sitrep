import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Package, MapPin, AlertTriangle } from 'lucide-react';
import { getFlightStats } from '../db/flights';
import { getEquipmentStats } from '../db/equipment';
import { getDeploymentStats } from '../db/deployments';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const navigate = useNavigate();
    const [flightStats, setFlightStats] = useState(null);
    const [equipmentStats, setEquipmentStats] = useState(null);
    const [deploymentStats, setDeploymentStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const { selectedDeploymentIds } = useDeployment();
    const { canEdit } = useAuth();

    useEffect(() => {
        loadStats();
    }, [selectedDeploymentIds]);

    const loadStats = async () => {
        try {
            setLoading(true);
            const [flights, equipment, deployments] = await Promise.all([
                getFlightStats(selectedDeploymentIds),
                getEquipmentStats(selectedDeploymentIds),
                getDeploymentStats()
            ]);

            setFlightStats(flights);
            setEquipmentStats(equipment);
            setDeploymentStats(deployments);
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-description">
                    Overview of AMCR operations, equipment status, and deployments
                </p>
            </div>

            {/* Global Deployment Filter Indicator */}
            {selectedDeploymentIds && selectedDeploymentIds.length > 0 && (
                <div className="card mb-4">
                    <div className="card-body py-3">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', color: 'var(--color-text-muted)' }}>
                            <span className="badge badge-info">Filtered by Deployment</span>
                            <span>Showing statistics for {selectedDeploymentIds.length} selected deployment{selectedDeploymentIds.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="stats-grid">
                {/* Total Flights */}
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon">
                            <Plane size={24} />
                        </div>
                    </div>
                    <div className="stat-label">Total Flights</div>
                    <div className="stat-value">{flightStats?.totalFlights || 0}</div>
                    <div className="stat-change">
                        Recorded missions
                    </div>
                </div>

                {/* Flight Hours */}
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon" style={{ color: 'var(--color-info)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                    </div>
                    <div className="stat-label">Flight Hours</div>
                    <div className="stat-value">{flightStats?.totalHours?.toFixed(1) || '0.0'}</div>
                    <div className="stat-change">
                        Total operational hours
                    </div>
                </div>

                {/* Active Deployments */}
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon" style={{ color: 'var(--color-success)' }}>
                            <MapPin size={24} />
                        </div>
                    </div>
                    <div className="stat-label">Active Deployments</div>
                    <div className="stat-value">{deploymentStats?.activeDeployments || 0}</div>
                    <div className="stat-change">
                        {deploymentStats?.totalDeployments || 0} total records
                    </div>
                </div>

                {/* Delayed Flights % */}
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon" style={{ color: 'var(--color-warning)' }}>
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                    <div className="stat-label">Delayed Flights</div>
                    <div className="stat-value">
                        {(() => {
                            const total = flightStats?.totalFlights || 0;
                            const delayed = flightStats?.byStatus?.['Delay'] || 0;
                            const percent = total > 0 ? (delayed / total) * 100 : 0;
                            return `${percent.toFixed(1)}%`;
                        })()}
                    </div>
                    <div className="stat-change">
                        Percentage of delays
                    </div>
                </div>

                {/* Mission Reliability */}
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon" style={{ color: 'var(--color-primary)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                    </div>
                    <div className="stat-label">Mission Reliability</div>
                    <div className="stat-value">
                        {flightStats?.missionReliability?.toFixed(1) || '100.0'}%
                    </div>
                    <div className="stat-change">
                        Shield AI Adjusted
                    </div>
                </div>

                {/* Flights to 95% */}
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon" style={{ color: 'var(--color-success)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                        </div>
                    </div>
                    <div className="stat-label">Flights to 95%</div>
                    <div className="stat-value">
                        {flightStats?.flightsTo95MRR || 0}
                    </div>
                    <div className="stat-change">
                        Changes required
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-2" style={{ gap: 'var(--spacing-lg)' }}>
                {/* Flight Status Breakdown */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Flight Status</h3>
                    </div>
                    <div className="card-body">
                        {flightStats?.byStatus && Object.keys(flightStats.byStatus).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                {Object.entries(flightStats.byStatus).map(([status, count]) => (
                                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="text-secondary">{status}</span>
                                        <span className="badge badge-info">{count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted">No flight data available</p>
                        )}
                    </div>
                </div>

                {/* Equipment Status Breakdown */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Equipment Status</h3>
                    </div>
                    <div className="card-body">
                        {equipmentStats?.byStatus && Object.keys(equipmentStats.byStatus).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                {Object.entries(equipmentStats.byStatus).map(([status, count]) => {
                                    let badgeClass = 'badge-info';
                                    if (status === 'FMC') badgeClass = 'badge-success';
                                    if (status === 'NMC') badgeClass = 'badge-error';
                                    if (status === 'PMC') badgeClass = 'badge-warning';
                                    if (status === 'CAT5') badgeClass = 'badge-secondary';

                                    return (
                                        <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="text-secondary">{status}</span>
                                            <span className={`badge ${badgeClass}`}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-muted">No equipment data available</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            {canEdit && (
                <div className="card" style={{ marginTop: 'var(--spacing-xl)' }}>
                    <div className="card-header">
                        <h3 className="card-title">Quick Actions</h3>
                    </div>
                    <div className="card-body">
                        <div className="page-actions">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/flights')}
                            >
                                <Plane size={18} />
                                Add Flight Entry
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/equipment')}
                            >
                                <Package size={18} />
                                Add Equipment
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/deployments')}
                            >
                                <MapPin size={18} />
                                Add Deployment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
