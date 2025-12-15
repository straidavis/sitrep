import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Download, Upload, Eye } from 'lucide-react';
import Modal from '../components/Modal';
import DeploymentForm from '../components/DeploymentForm';
import {
    getAllDeployments,
    addDeployment,
    updateDeployment,
    deleteDeployment
} from '../db/deployments';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const Deployments = () => {
    const { canEdit } = useAuth();

    const [deployments, setDeployments] = useState([]);
    const [filteredDeployments, setFilteredDeployments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        type: '',
        status: '',
        location: ''
    });

    const [showModal, setShowModal] = useState(false);
    const [editingDeployment, setEditingDeployment] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    // eslint-disable-next-line no-unused-vars
    const [viewMode, setViewMode] = useState('table');

    useEffect(() => {
        loadDeployments();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [deployments, searchTerm, filters]);

    const loadDeployments = async () => {
        try {
            setLoading(true);
            const data = await getAllDeployments();
            setDeployments(data);
        } catch (error) {
            console.error('Error loading deployments:', error);
            alert('Failed to load deployments');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...deployments];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(dep =>
                dep.name?.toLowerCase().includes(term) ||
                dep.location?.toLowerCase().includes(term) ||
                dep.notes?.toLowerCase().includes(term)
            );
        }

        if (filters.type) {
            filtered = filtered.filter(d => d.type === filters.type);
        }

        if (filters.status) {
            filtered = filtered.filter(d => d.status === filters.status);
        }

        if (filters.location) {
            filtered = filtered.filter(d =>
                d.location?.toLowerCase().includes(filters.location.toLowerCase())
            );
        }

        setFilteredDeployments(filtered);
    };

    const handleAddDeployment = () => {
        if (!canEdit) return;
        setEditingDeployment(null);
        setShowModal(true);
    };

    const handleEditDeployment = (deployment) => {
        setEditingDeployment(deployment);
        setShowModal(true);
    };

    const handleSaveDeployment = async (deploymentData) => {
        try {
            if (editingDeployment) {
                await updateDeployment(editingDeployment.id, deploymentData);
            } else {
                await addDeployment(deploymentData);
            }
            setShowModal(false);
            setEditingDeployment(null);
            await loadDeployments();
        } catch (error) {
            console.error('Error saving deployment:', error);
            alert('Failed to save deployment');
        }
    };

    const handleDeleteDeployment = async (id) => {
        if (!canEdit) return;
        if (!confirm('Are you sure you want to delete this deployment?')) return;

        try {
            await deleteDeployment(id);
            await loadDeployments();
        } catch (error) {
            console.error('Error deleting deployment:', error);
            alert('Failed to delete deployment');
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            type: '',
            status: '',
            location: ''
        });
        setSearchTerm('');
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Active': return 'badge-success';
            case 'Planning': return 'badge-info';
            case 'Completed': return 'badge-success';
            case 'Cancelled': return 'badge-error';
            default: return 'badge-info';
        }
    };

    const calculateDuration = (startDate, endDate) => {
        const days = differenceInDays(new Date(endDate), new Date(startDate));
        return days + 1;
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
                <h1 className="page-title">Deployments</h1>
                <p className="page-description">
                    Manage deployment events and associated resources
                </p>

                <div className="page-actions">
                    {canEdit && (
                        <button className="btn btn-primary" onClick={handleAddDeployment}>
                            <Plus size={18} />
                            Add Deployment
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
                            placeholder="Search deployments by name, location, or notes..."
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
                        <div className="grid grid-cols-3" style={{ gap: 'var(--spacing-md)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Type</label>
                                <select
                                    name="type"
                                    className="select"
                                    value={filters.type}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Types</option>
                                    <option value="Land">Land</option>
                                    <option value="Shore">Shore</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Status</label>
                                <select
                                    name="status"
                                    className="select"
                                    value={filters.status}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Planning">Planning</option>
                                    <option value="Active">Active</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    className="input"
                                    placeholder="Filter by location"
                                    value={filters.location}
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
                Showing {filteredDeployments.length} of {deployments.length} deployments
            </div>

            {/* Deployments Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Ship/Location</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Duration</th>

                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDeployments.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                        <p className="text-muted">
                                            {deployments.length === 0
                                                ? 'No deployments recorded yet.'
                                                : 'No deployments match your search criteria.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredDeployments.map((deployment) => {
                                    const isInactive = ['Completed', 'Cancelled'].includes(deployment.status);
                                    const rowStyle = isInactive ? {
                                        opacity: 0.6,
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        filter: 'grayscale(1)'
                                    } : {};

                                    return (
                                        <tr key={deployment.id} style={rowStyle}>
                                            <td className="font-semibold">{deployment.name}</td>
                                            <td>
                                                <span className="badge badge-info">{deployment.type}</span>
                                            </td>
                                            <td>{deployment.location}</td>
                                            <td>{format(new Date(deployment.startDate), 'MMM dd, yyyy')}</td>
                                            <td>{format(new Date(deployment.endDate), 'MMM dd, yyyy')}</td>
                                            <td>
                                                {calculateDuration(deployment.startDate, deployment.endDate)} days
                                            </td>

                                            <td>
                                                <span className={`badge ${getStatusBadgeClass(deployment.status)}`}>
                                                    {deployment.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => handleEditDeployment(deployment)}
                                                        title={canEdit ? "Edit" : "View"}
                                                    >
                                                        {canEdit ? <Edit size={16} /> : <Eye size={16} />}
                                                    </button>
                                                    {canEdit && (
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => handleDeleteDeployment(deployment.id)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
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
                    setEditingDeployment(null);
                }}
                title={editingDeployment ? (canEdit ? 'Edit Deployment' : 'View Deployment') : 'Add New Deployment'}
                size="lg"
            >
                <DeploymentForm
                    deployment={editingDeployment}
                    onSave={handleSaveDeployment}
                    onCancel={() => {
                        setShowModal(false);
                        setEditingDeployment(null);
                    }}
                />
            </Modal>
        </div>
    );
};

export default Deployments;
