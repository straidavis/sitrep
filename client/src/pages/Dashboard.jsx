import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Package, MapPin, AlertTriangle, Users, Scale, Activity, TrendingUp, Target, Clock, Search, CheckCircle2 } from 'lucide-react';
import { getFlightStats } from '../db/flights';
import { getEquipmentStats } from '../db/equipment';
import { getDeploymentStats } from '../db/deployments';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';

import { getMissingKitItems } from '../db/kits';

const Dashboard = () => {
    const navigate = useNavigate();
    const [flightStats, setFlightStats] = useState(null);
    const [equipmentStats, setEquipmentStats] = useState(null);
    const [deploymentStats, setDeploymentStats] = useState(null);
    const [missingItems, setMissingItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const { selectedDeploymentIds } = useDeployment();
    const { canEdit } = useAuth();

    useEffect(() => {
        loadStats();
    }, [selectedDeploymentIds]);

    const loadStats = async () => {
        try {
            setLoading(true);
            const [flights, equipment, deployments, missing] = await Promise.all([
                getFlightStats(selectedDeploymentIds),
                getEquipmentStats(selectedDeploymentIds),
                getDeploymentStats(),
                getMissingKitItems(selectedDeploymentIds)
            ]);

            setFlightStats(flights);
            setEquipmentStats(equipment);
            setDeploymentStats(deployments);
            setMissingItems(missing);
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

            {/* Flight Activity Stats */}
            <div className="mb-8">
                <h3 className="section-title text-sm font-bold text-muted uppercase tracking-wider mb-4">Flight Activity</h3>
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
                        <div className="stat-change">Recorded missions</div>
                    </div>

                    {/* Flight Hours */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: 'var(--color-info)' }}>
                                <Clock size={24} />
                            </div>
                        </div>
                        <div className="stat-label">Flight Hours</div>
                        <div className="stat-value">{flightStats?.totalHours?.toFixed(1) || '0.0'}</div>
                        <div className="stat-change">Total operational hours</div>
                    </div>
                </div>
            </div>

            {/* Operational Findings */}
            <div className="mb-8">
                <h3 className="section-title text-sm font-bold text-muted uppercase tracking-wider mb-4">Operational Findings</h3>
                <div className="stats-grid">
                    {/* TOIs */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: '#8b5cf6' }}>
                                <Search size={24} />
                            </div>
                        </div>
                        <div className="stat-label">TOIs</div>
                        <div className="stat-value">{flightStats?.totalTOIs || 0}</div>
                        <div className="stat-change">Targets of Interest</div>
                    </div>

                    {/* Contraband */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: 'var(--color-warning)' }}>
                                <Scale size={24} />
                            </div>
                        </div>
                        <div className="stat-label">Contraband</div>
                        <div className="stat-value">{flightStats?.totalContraband?.toLocaleString() || 0} <span className="text-sm font-normal text-muted">lbs</span></div>
                        <div className="stat-change">Total Seized</div>
                    </div>

                    {/* Detainees */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: 'var(--color-error)' }}>
                                <Users size={24} />
                            </div>
                        </div>
                        <div className="stat-label">Detainees</div>
                        <div className="stat-value">{flightStats?.totalDetainees || 0}</div>
                        <div className="stat-change">Total Detained</div>
                    </div>
                </div>
            </div>

            {/* Critical Shortages */}
            <div className="mb-8">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                    <h3 className="section-title text-sm font-bold text-muted uppercase tracking-wider">Critical Shortages</h3>
                    {missingItems.length > 0 && (
                        <span className="badge badge-error">{missingItems.length} Missing Items</span>
                    )}
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container" style={{ border: 'none', borderRadius: 0, maxHeight: '300px', overflowY: 'auto' }}>
                        <table className="table">
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr>
                                    <th>Part Number</th>
                                    <th>Description</th>
                                    <th>Kit</th>
                                    <th>Missing Qty</th>
                                    <th>Deployment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {missingItems.length > 0 ? (
                                    missingItems.map((item, index) => (
                                        <tr key={`${item.partNumber}-${index}`}>
                                            <td className="font-mono text-xs">{item.partNumber}</td>
                                            <td>{item.description}</td>
                                            <td className="text-muted text-xs">{item.kitName}</td>
                                            <td>
                                                <span className="badge badge-error">-{item.missingQuantity}</span>
                                            </td>
                                            <td className="text-muted text-xs">{item.deploymentName}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="text-center py-8 text-muted">
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <CheckCircle2 size={24} className="text-success" />
                                                <span>All kits are fully stocked!</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="mb-8">
                <h3 className="section-title text-sm font-bold text-muted uppercase tracking-wider mb-4">System Performance</h3>
                <div className="stats-grid">
                    {/* Availability Rating */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: 'var(--color-primary)' }}>
                                <Package size={24} />
                            </div>
                        </div>
                        <div className="stat-label">Availability Rating</div>
                        <div className="stat-value">{equipmentStats?.availabilityRating?.toFixed(1) || '0.0'}%</div>
                        <div className="stat-change">System Availability</div>
                    </div>

                    {/* Tasking Rating */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: 'var(--color-accent-secondary)' }}>
                                <Target size={24} />
                            </div>
                        </div>
                        <div className="stat-label">Tasking Rating</div>
                        <div className="stat-value">{flightStats?.taskingRating?.toFixed(1) || '0.0'}%</div>
                        <div className="stat-change">Tasking Efficiency</div>
                    </div>

                    {/* Mission Reliability */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: 'var(--color-success)' }}>
                                <Activity size={24} />
                            </div>
                        </div>
                        <div className="stat-label">Mission Reliability (MRR)</div>
                        <div className="stat-value">{flightStats?.missionReliability?.toFixed(1) || '100.0'}%</div>
                        <div className="stat-change">User Adjusted</div>
                    </div>

                    {/* Flights to 95% */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: '#ec4899' }}>
                                <TrendingUp size={24} />
                            </div>
                        </div>
                        <div className="stat-label">Flights to 95% MRR</div>
                        <div className="stat-value">{flightStats?.flightsTo95MRR || 0}</div>
                        <div className="stat-change">Successes required</div>
                    </div>
                </div>
            </div >

            {/* Recent Activity */}
            < div className="grid grid-cols-2" style={{ gap: 'var(--spacing-lg)' }}>
                {/* Flight Status Breakdown */}
                < div className="card" >
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
                </div >

                {/* Equipment Status Breakdown */}
                < div className="card" >
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
                </div >
            </div >

            {/* Quick Actions */}
            {
                canEdit && (
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
                )
            }
        </div >
    );
};

export default Dashboard;
