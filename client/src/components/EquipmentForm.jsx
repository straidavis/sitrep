import React, { useState, useEffect } from 'react';
import { getAllDeployments } from '../db/deployments';
import { useAuth } from '../context/AuthContext';

const EquipmentForm = ({ equipment, onSave, onCancel }) => {
    const { canEdit } = useAuth();

    const [formData, setFormData] = useState({
        date: '',
        category: 'Aircraft',
        equipment: '',
        serialNumber: '',
        status: 'FMC',
        deploymentId: '',
        location: '',
        software: '',
        comments: ''
    });

    const [errors, setErrors] = useState({});
    const [deployments, setDeployments] = useState([]);

    const categories = ['Aircraft', 'Payloads', 'Launchers', 'GCS', 'Radios'];
    const statuses = [
        { value: 'FMC', label: 'FMC', color: 'green' },
        { value: 'PMC', label: 'PMC', color: 'yellow' },
        { value: 'NMC', label: 'NMC', color: 'red' },
        { value: 'CAT5', label: 'CAT5', color: 'grey' }
    ];

    useEffect(() => {
        loadDeployments();
    }, []);

    useEffect(() => {
        if (equipment) {
            setFormData({
                date: equipment.date || '',
                category: equipment.category || 'Aircraft',
                equipment: equipment.equipment || '',
                serialNumber: equipment.serialNumber || '',
                status: equipment.status || 'FMC',
                deploymentId: equipment.deploymentId || '',
                location: equipment.location || '',
                software: equipment.software || '',
                comments: equipment.comments || ''
            });
        }
    }, [equipment]);

    const loadDeployments = async () => {
        try {
            const data = await getAllDeployments();
            setDeployments(data);
        } catch (error) {
            console.error('Error loading deployments:', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.date) {
            newErrors.date = 'Date is required';
        }
        if (!formData.equipment) {
            newErrors.equipment = 'Equipment name is required';
        }
        if (!formData.serialNumber) {
            newErrors.serialNumber = 'Serial number is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        const now = new Date().toISOString();
        const equipmentData = {
            ...formData,
            deploymentId: formData.deploymentId ? parseInt(formData.deploymentId) : null,
            updatedAt: now,
            createdAt: equipment?.createdAt || now
        };

        onSave(equipmentData);
    };

    return (
        <form onSubmit={handleSubmit} className="form">
            <div className="form-grid">
                {/* Date */}
                <div className="form-group">
                    <label htmlFor="date" className="form-label">
                        Date <span className="text-danger">*</span>
                    </label>
                    <input
                        type="date"
                        id="date"
                        name="date"
                        className={`form-input ${errors.date ? 'error' : ''}`}
                        value={formData.date}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.date && <span className="error-message">{errors.date}</span>}
                </div>

                {/* Category */}
                <div className="form-group">
                    <label htmlFor="category" className="form-label">
                        Category <span className="text-danger">*</span>
                    </label>
                    <select
                        id="category"
                        name="category"
                        className="form-input"
                        value={formData.category}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {/* Equipment Name */}
                <div className="form-group">
                    <label htmlFor="equipment" className="form-label">
                        Equipment <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        id="equipment"
                        name="equipment"
                        className={`form-input ${errors.equipment ? 'error' : ''}`}
                        value={formData.equipment}
                        onChange={handleChange}
                        placeholder="Enter equipment name"
                        disabled={!canEdit}
                    />
                    {errors.equipment && <span className="error-message">{errors.equipment}</span>}
                </div>

                {/* Serial Number */}
                <div className="form-group">
                    <label htmlFor="serialNumber" className="form-label">
                        Serial Number <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        id="serialNumber"
                        name="serialNumber"
                        className={`form-input ${errors.serialNumber ? 'error' : ''}`}
                        value={formData.serialNumber}
                        onChange={handleChange}
                        placeholder="Enter serial number"
                        disabled={!canEdit}
                    />
                    {errors.serialNumber && <span className="error-message">{errors.serialNumber}</span>}
                </div>

                {/* Status */}
                <div className="form-group">
                    <label htmlFor="status" className="form-label">
                        Status <span className="text-danger">*</span>
                    </label>
                    <select
                        id="status"
                        name="status"
                        className="form-input"
                        value={formData.status}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        {statuses.map(status => (
                            <option key={status.value} value={status.value}>
                                {status.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Deployment */}
                <div className="form-group">
                    <label htmlFor="deploymentId" className="form-label">
                        Deployment
                    </label>
                    <select
                        id="deploymentId"
                        name="deploymentId"
                        className="form-input"
                        value={formData.deploymentId}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        <option value="">Select Deployment (Optional)</option>
                        {deployments.map(deployment => (
                            <option key={deployment.id} value={deployment.id}>
                                {deployment.name} - {deployment.location}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Location */}
                <div className="form-group">
                    <label htmlFor="location" className="form-label">
                        Location
                    </label>
                    <input
                        type="text"
                        id="location"
                        name="location"
                        className="form-input"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="Enter location"
                        disabled={!canEdit}
                    />
                </div>

                {/* Software */}
                <div className="form-group">
                    <label htmlFor="software" className="form-label">
                        Software
                    </label>
                    <input
                        type="text"
                        id="software"
                        name="software"
                        className="form-input"
                        value={formData.software}
                        onChange={handleChange}
                        placeholder="Enter software version"
                        disabled={!canEdit}
                    />
                </div>

                {/* Comments */}
                <div className="form-group full-width">
                    <label htmlFor="comments" className="form-label">
                        Comments
                    </label>
                    <textarea
                        id="comments"
                        name="comments"
                        className="form-input"
                        value={formData.comments}
                        onChange={handleChange}
                        placeholder="Enter any additional comments"
                        rows="3"
                        disabled={!canEdit}
                    />
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Close
                </button>
                {canEdit && (
                    <button type="submit" className="btn btn-primary">
                        {equipment ? 'Update Equipment' : 'Add Equipment'}
                    </button>
                )}
                {!canEdit && (
                    <span className="text-muted text-sm italic ml-4">Read Only Mode</span>
                )}
            </div>
        </form>
    );
};

export default EquipmentForm;
