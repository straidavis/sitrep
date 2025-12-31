import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Package, MapPin, AlertTriangle, Users, Scale, Activity, TrendingUp, Target, Clock, Search, CheckCircle2 } from 'lucide-react';
import { calculateFlightMetrics } from '../utils/metrics';
import { getAllEquipment, getEquipmentStats } from '../db/equipment';
import { getAllFlights } from '../db/flights';
import { getDeploymentStats, getAllDeployments } from '../db/deployments';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';

import { getMissingKitItems } from '../db/kits';

const Dashboard = () => {
    const navigate = useNavigate();
    const [flightStats, setFlightStats] = useState(null);
    const [equipmentStats, setEquipmentStats] = useState(null);
    const [deploymentStats, setDeploymentStats] = useState(null);
    const [deploymentPerformance, setDeploymentPerformance] = useState([]);
    const [equipmentReadiness, setEquipmentReadiness] = useState([]);
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
            const [allFlights, equipment, deployments, missing, allDeploymentsList] = await Promise.all([
                getAllFlights(),
                getEquipmentStats(selectedDeploymentIds),
                getDeploymentStats(),
                getMissingKitItems(selectedDeploymentIds),
                getAllDeployments()
            ]);

            // Filter Flights by Selected Deployments
            const filteredFlights = (selectedDeploymentIds && selectedDeploymentIds.length > 0)
                ? allFlights.filter(f => selectedDeploymentIds.includes(f.deploymentId))
                : allFlights;

            const metrics = calculateFlightMetrics(filteredFlights);

            // 1. Establish the "Master List" of deployments to display
            // Filter by context if set, otherwise show all. Sort alphabetically.
            const sortedDeployments = (selectedDeploymentIds && selectedDeploymentIds.length > 0)
                ? allDeploymentsList.filter(d => selectedDeploymentIds.includes(d.id))
                : allDeploymentsList;

            sortedDeployments.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            // 2. Deployment Performance
            // Group flights by deploymentId first for easy lookup
            const flightsByDeployment = allFlights.reduce((acc, flight) => {
                if (!acc[flight.deploymentId]) acc[flight.deploymentId] = [];
                acc[flight.deploymentId].push(flight);
                return acc;
            }, {});

            const performanceData = sortedDeployments.map(dep => {
                const depFlights = flightsByDeployment[dep.id] || [];
                return {
                    id: dep.id,
                    name: dep.name,
                    ...calculateFlightMetrics(depFlights)
                };
            });

            // 3. Equipment Readiness
            const rawEquipment = await getAllEquipment();
            const readinessData = sortedDeployments.map(dep => {
                const depEquip = rawEquipment.filter(e => String(e.deploymentId) === String(dep.id));

                const fmcAircraft = depEquip.filter(e =>
                    e.status === 'FMC' &&
                    ((e.category && e.category.includes('Aircraft')) || (e.equipment && e.equipment.includes('Aircraft')))
                ).length;

                const fmcPayloads = depEquip.filter(e =>
                    e.status === 'FMC' &&
                    ((e.category && e.category.includes('Payload')) || (e.equipment && e.equipment.includes('Payload')))
                ).length;

                return {
                    id: dep.id,
                    name: dep.name,
                    fmcAircraft,
                    fmcPayloads
                };
            });

            // 4. Critical Shortages
            // Sort missing items to match deployment order
            const sortedMissing = missing.sort((a, b) => {
                const depA = sortedDeployments.find(d => d.name === a.deploymentName);
                const depB = sortedDeployments.find(d => d.name === b.deploymentName);
                // If checking by name
                return (a.deploymentName || '').localeCompare(b.deploymentName || '');
            });

            // Update State
            setFlightStats(metrics);
            setEquipmentStats(equipment);
            setDeploymentStats(deployments);
            setMissingItems(sortedMissing);
            setDeploymentPerformance(performanceData);
            setEquipmentReadiness(readinessData);
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                        <h1 className="page-title">Dashboard</h1>
                        <p className="page-description">
                            Overview of AMCR operations, equipment status, and deployments
                        </p>
                    </div>
                    {missingItems.length > 0 && (
                        <div
                            className="badge badge-error cursor-pointer flex items-center gap-2"
                            style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '0.9rem' }}
                            onClick={() => document.getElementById('critical-shortages').scrollIntoView({ behavior: 'smooth' })}
                        >
                            <AlertTriangle size={16} />
                            <span>{missingItems.length} Critical Shortages</span>
                        </div>
                    )}
                </div>
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

            {/* Critical Shortages Moved to Bottom */}

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
                        <div className="stat-value">{flightStats?.availability?.toFixed(1) || '100.0'}%</div>
                        <div className="stat-change">System Availability</div>
                    </div>

                    {/* On-Time Flight Rating */}
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon" style={{ color: 'var(--color-accent-secondary)' }}>
                                <Clock size={24} />
                            </div>
                        </div>
                        <div className="stat-label">On-Time Flight Rating</div>
                        <div className="stat-value">{flightStats?.onTimeRating?.toFixed(1) || '100.0'}%</div>
                        <div className="stat-change">Schedule Adherence</div>
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
                        <div className="stat-value">{flightStats?.flightsTo95 || 0}</div>
                        <div className="stat-change">Successes required</div>
                    </div>
                </div>
            </div >

            {/* Equipment Readiness Table */}
            <div className="card w-full mb-8">
                <div className="card-header">
                    <h3 className="card-title">Equipment Readiness</h3>
                </div>
                <div className="card-body p-0">
                    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Deployment</th>
                                    <th className="text-right">FMC Aircraft</th>
                                    <th className="text-right">FMC Payloads</th>
                                </tr>
                            </thead>
                            <tbody>
                                {equipmentReadiness.length > 0 ? (
                                    equipmentReadiness.map(dep => {
                                        // Aircraft Color Logic: >2 Green, =2 Yellow, <2 Red
                                        let airBadge = 'badge-error';
                                        if (dep.fmcAircraft > 2) airBadge = 'badge-success';
                                        else if (dep.fmcAircraft === 2) airBadge = 'badge-warning';

                                        // Payload Color Logic: >3 Green, =3 Yellow, <3 Red
                                        let payloadBadge = 'badge-error';
                                        if (dep.fmcPayloads > 3) payloadBadge = 'badge-success';
                                        else if (dep.fmcPayloads === 3) payloadBadge = 'badge-warning';

                                        return (
                                            <tr key={dep.id}>
                                                <td className="font-medium">{dep.name}</td>
                                                <td className="text-right">
                                                    <span className={`badge ${airBadge} badge-outline text-xs font-bold px-3 py-1`}>
                                                        {dep.fmcAircraft}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <span className={`badge ${payloadBadge} badge-outline text-xs font-bold px-3 py-1`}>
                                                        {dep.fmcPayloads}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="text-center text-muted py-4">No readiness data available</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Deployment Performance Table */}
            <div className="card w-full mb-8">
                <div className="card-header">
                    <h3 className="card-title">Deployment Performance</h3>
                </div>
                <div className="card-body p-0">
                    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Deployment</th>
                                    <th className="text-right">Flown</th>
                                    <th className="text-right">Total CNX</th>
                                    <th className="text-right">Shield AI CNX</th>
                                    <th className="text-right text-success">MRR</th>
                                    <th className="text-right text-primary">Availability Rating</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deploymentPerformance.length > 0 ? (
                                    deploymentPerformance.map(dep => (
                                        <tr key={dep.id}>
                                            <td className="font-medium">{dep.name}</td>
                                            <td className="text-right">{dep.totalFlights}</td>
                                            <td className="text-right">{dep.cancelled}</td>
                                            <td className="text-right">{dep.shieldAiCnx}</td>
                                            <td className="text-right font-bold text-success">{dep.missionReliability}%</td>
                                            <td className="text-right font-bold text-primary">{dep.availability}%</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center text-muted py-4">No deployment data available</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Critical Shortages Table */}
            {missingItems.length > 0 && (
                <div id="critical-shortages" className="card w-full mb-8 border-error/50">
                    <div className="card-header bg-error/10">
                        <div className="flex items-center gap-2 text-error">
                            <AlertTriangle size={20} />
                            <h3 className="card-title text-error">Critical Shortages</h3>
                        </div>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Deployment</th>
                                        <th>Kit</th>
                                        <th>Item</th>
                                        <th className="text-right">Required</th>
                                        <th className="text-right">Actual</th>
                                        <th className="text-right text-error">Missing</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {missingItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-error/5">
                                            <td className="font-medium">{item.deploymentName || 'Unassigned'}</td>
                                            <td>{item.kitName}</td>
                                            <td>
                                                <div className="font-medium">{item.partNumber}</div>
                                                <div className="text-xs text-muted">{item.description}</div>
                                            </td>
                                            <td className="text-right">{item.quantity}</td>
                                            <td className="text-right">{item.actualQuantity || 0}</td>
                                            <td className="text-right font-bold text-error">-{item.missingQuantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

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
