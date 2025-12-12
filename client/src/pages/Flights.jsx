import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Download, Upload, Eye } from 'lucide-react';
import Modal from '../components/Modal';
import FlightForm from '../components/FlightForm';
import {
    getAllFlights,
    addFlight,
    updateFlight,
    deleteFlight
} from '../db/flights';
import { format } from 'date-fns';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';

const Flights = () => {
    const { canEdit } = useAuth();

    const [flights, setFlights] = useState([]);
    const [filteredFlights, setFilteredFlights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: '',
        riskLevel: '',
        startDate: '',
        endDate: ''
    });

    const { selectedDeploymentIds } = useDeployment();

    const [showModal, setShowModal] = useState(false);
    const [editingFlight, setEditingFlight] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadFlights();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [flights, searchTerm, filters, selectedDeploymentIds]);

    const loadFlights = async () => {
        try {
            setLoading(true);
            const data = await getAllFlights();
            setFlights(data);
        } catch (error) {
            console.error('Error loading flights:', error);
            alert('Failed to load flights');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...flights];

        // Global Deployment Filter
        if (selectedDeploymentIds && selectedDeploymentIds.length > 0) {
            filtered = filtered.filter(f => selectedDeploymentIds.includes(f.deploymentId));
        }

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(flight =>
                flight.aircraftNumber?.toLowerCase().includes(term) ||
                flight.missionNumber?.toLowerCase().includes(term) ||
                flight.reason?.toLowerCase().includes(term) ||
                flight.notes?.toLowerCase().includes(term)
            );
        }

        // Status filter
        if (filters.status) {
            filtered = filtered.filter(f => f.status === filters.status);
        }

        // Risk level filter
        if (filters.riskLevel) {
            filtered = filtered.filter(f => f.riskLevel === filters.riskLevel);
        }

        // Date range filter
        if (filters.startDate) {
            filtered = filtered.filter(f => f.date >= new Date(filters.startDate).toISOString());
        }
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59);
            filtered = filtered.filter(f => f.date <= endDate.toISOString());
        }

        setFilteredFlights(filtered);
    };

    const handleAddFlight = () => {
        if (!canEdit) return;
        setEditingFlight(null);
        setShowModal(true);
    };

    const handleEditFlight = (flight) => {
        setEditingFlight(flight);
        setShowModal(true);
    };

    const handleSaveFlight = async (flightData) => {
        try {
            if (editingFlight) {
                await updateFlight(editingFlight.id, flightData);
            } else {
                // If a single deployment is selected globally, auto-assign it
                if (selectedDeploymentIds && selectedDeploymentIds.length === 1 && !flightData.deploymentId) {
                    flightData.deploymentId = parseInt(selectedDeploymentIds[0]);
                }
                await addFlight(flightData);
            }
            setShowModal(false);
            setEditingFlight(null);
            await loadFlights();
        } catch (error) {
            console.error('Error saving flight:', error);
            alert('Failed to save flight');
        }
    };

    const handleDeleteFlight = async (id) => {
        if (!canEdit) return;
        if (!confirm('Are you sure you want to delete this flight?')) return;

        try {
            await deleteFlight(id);
            await loadFlights();
        } catch (error) {
            console.error('Error deleting flight:', error);
            alert('Failed to delete flight');
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            status: '',
            riskLevel: '',
            startDate: '',
            endDate: ''
        });
        setSearchTerm('');
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Complete': return 'badge-success';
            case 'CNX': return 'badge-error';
            case 'Delay': return 'badge-warning';
            case 'Alert': return 'badge-info';
            default: return 'badge-info';
        }
    };

    const getRiskBadgeClass = (risk) => {
        switch (risk) {
            case 'Low': return 'badge-success';
            case 'Med': return 'badge-warning';
            case 'High': return 'badge-error';
            default: return 'badge-info';
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
                <h1 className="page-title">Flights (AMCR)</h1>
                <p className="page-description">
                    Manage flight operations and situation reports
                </p>

                <div className="page-actions">
                    {canEdit && (
                        <button className="btn btn-primary" onClick={handleAddFlight}>
                            <Plus size={18} />
                            Add Flight
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={18} />
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>
                    <button className="btn btn-secondary">
                        <Download size={18} />
                        Export
                    </button>
                    {canEdit && (
                        <button className="btn btn-secondary">
                            <Upload size={18} />
                            Import
                        </button>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="card-body">
                    <div style={{ position: 'relative' }}>
                        <Search
                            size={20}
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--color-text-muted)'
                            }}
                        />
                        <input
                            type="text"
                            className="input"
                            placeholder="Search flights by aircraft #, mission #, reason, or notes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '40px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div className="card-header">
                        <h3 className="card-title">Filters</h3>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-cols-4" style={{ gap: 'var(--spacing-md)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Status</label>
                                <select
                                    name="status"
                                    className="select"
                                    value={filters.status}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Complete">Complete</option>
                                    <option value="CNX">CNX</option>
                                    <option value="Delay">Delay</option>
                                    <option value="Alert">Alert</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Risk Level</label>
                                <select
                                    name="riskLevel"
                                    className="select"
                                    value={filters.riskLevel}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Levels</option>
                                    <option value="Low">Low</option>
                                    <option value="Med">Med</option>
                                    <option value="High">High</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Start Date</label>
                                <input
                                    type="date"
                                    name="startDate"
                                    className="input"
                                    value={filters.startDate}
                                    onChange={handleFilterChange}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">End Date</label>
                                <input
                                    type="date"
                                    name="endDate"
                                    className="input"
                                    value={filters.endDate}
                                    onChange={handleFilterChange}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Summary */}
            <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-muted)' }}>
                Showing {filteredFlights.length} of {flights.length} flights
                {selectedDeploymentIds && selectedDeploymentIds.length > 0 && (
                    <span className="badge badge-info" style={{ marginLeft: '10px' }}>
                        Filtered by Deployment ({selectedDeploymentIds.length})
                    </span>
                )}
            </div>

            {/* Flights Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Mission #</th>
                                <th>Aircraft #</th>
                                <th>Scheduled</th>
                                <th>Launch</th>
                                <th>Recovery</th>
                                <th>Hours</th>
                                <th>Risk</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFlights.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                        <p className="text-muted">
                                            {flights.length === 0
                                                ? 'No flights recorded yet.'
                                                : 'No flights match your search criteria.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredFlights.map((flight) => (
                                    <tr key={flight.id}>
                                        <td>{format(new Date(flight.date), 'MMM dd, yyyy')}</td>
                                        <td className="font-mono font-semibold">{flight.missionNumber}</td>
                                        <td className="font-mono font-semibold">{flight.aircraftNumber}</td>
                                        <td>{flight.scheduledLaunchTime || '-'}</td>
                                        <td>{flight.launchTime || '-'}</td>
                                        <td>{flight.recoveryTime || '-'}</td>
                                        <td>{flight.hours?.toFixed(1) || '0.0'}</td>
                                        <td>
                                            <span className={`badge ${getRiskBadgeClass(flight.riskLevel)}`}>
                                                {flight.riskLevel}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${getStatusBadgeClass(flight.status)}`}>
                                                {flight.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => handleEditFlight(flight)}
                                                    title={canEdit ? "Edit" : "View"}
                                                >
                                                    {canEdit ? <Edit size={16} /> : <Eye size={16} />}
                                                </button>
                                                {canEdit && (
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDeleteFlight(flight.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingFlight(null);
                }}
                title={editingFlight ? (canEdit ? 'Edit Flight' : 'View Flight') : 'Add New Flight'}
                size="lg"
            >
                <FlightForm
                    flight={editingFlight}
                    onSave={handleSaveFlight}
                    onCancel={() => {
                        setShowModal(false);
                        setEditingFlight(null);
                    }}
                />
            </Modal>
        </div>
    );
};

export default Flights;
