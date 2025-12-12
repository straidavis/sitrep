import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DeploymentForm = ({ deployment, onSave, onCancel }) => {
    const { canEdit } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        type: 'Shore',
        startDate: '',
        endDate: '',
        location: '',
        equipment: '',
        clins15Day: '',
        clins1Day: '',
        overAndAbove: '',
        status: 'Planning',
        notes: ''
    });

    const [errors, setErrors] = useState({});
    const [calculatedTotal, setCalculatedTotal] = useState(0);
    const [durationWarning, setDurationWarning] = useState('');

    useEffect(() => {
        if (deployment) {
            setFormData({
                name: deployment.name || '',
                type: deployment.type || 'Shore',
                startDate: deployment.startDate?.split('T')[0] || '',
                endDate: deployment.endDate?.split('T')[0] || '',
                location: deployment.location || '',
                equipment: deployment.equipment?.join(', ') || '',
                clins15Day: deployment.financials?.clins15Day || '',
                clins1Day: deployment.financials?.clins1Day || '',
                overAndAbove: deployment.financials?.overAndAbove || '',
                status: deployment.status || 'Planning',
                notes: deployment.notes || ''
            });
        }
    }, [deployment]);

    const deploymentTypes = ['Shore', 'Ship'];
    const statuses = ['Planning', 'Active', 'Completed', 'Cancelled'];

    // Calculate financials and validations whenever relevant fields change
    useEffect(() => {
        calculateFinancials();
    }, [formData.startDate, formData.endDate, formData.type, formData.clins15Day, formData.overAndAbove, formData.clins1Day]);

    const calculateFinancials = () => {
        if (!formData.startDate || !formData.endDate) {
            setCalculatedTotal(0);
            setDurationWarning('');
            return;
        }

        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

        if (formData.type === 'Shore') {
            // Check for 15-day increments
            if (diffDays % 15 !== 0) {
                setDurationWarning(`Shore deployments must be increments of 15 days. Current duration: ${diffDays} days.`);
            } else {
                setDurationWarning('');
            }

            // Calculate Price: (15dayCLIN + OverAndAbove) per 15 days
            const periods = Math.ceil(diffDays / 15);
            const pricePerPeriod = (parseFloat(formData.clins15Day) || 0) + (parseFloat(formData.overAndAbove) || 0);
            setCalculatedTotal(periods * pricePerPeriod);
        } else {
            // Ship: use 1-day CLIN * days
            const daily = (parseFloat(formData.clins1Day) || 0) * diffDays;
            setCalculatedTotal(daily);
            setDurationWarning('');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.name) newErrors.name = 'Ship/Location is required';
        if (!formData.startDate) newErrors.startDate = 'Start date is required';
        if (!formData.endDate) newErrors.endDate = 'End date is required';
        if (!formData.location) newErrors.location = 'Description is required';

        // Validate date range
        if (formData.startDate && formData.endDate) {
            if (new Date(formData.endDate) < new Date(formData.startDate)) {
                newErrors.endDate = 'End date must be after start date';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validate()) return;

        const deploymentData = {
            name: formData.name,
            type: formData.type,
            startDate: new Date(formData.startDate).toISOString(),
            endDate: new Date(formData.endDate).toISOString(),
            location: formData.location,
            equipment: formData.equipment
                .split(',')
                .map(e => e.trim())
                .filter(e => e),
            financials: {
                clins15Day: parseFloat(formData.clins15Day) || 0,
                clins1Day: parseFloat(formData.clins1Day) || 0,
                overAndAbove: parseFloat(formData.overAndAbove) || 0
            },
            status: formData.status,
            notes: formData.notes
        };

        onSave(deploymentData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2" style={{ gap: 'var(--spacing-lg)' }}>
                {/* Ship/Location (formerly Deployment Name) */}
                <div className="form-group">
                    <label className="form-label">Ship/Location *</label>
                    <input
                        type="text"
                        name="name"
                        className="input"
                        placeholder="e.g., USCGC STONE / Operation Atlantic Shield"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.name && <span className="form-error">{errors.name}</span>}
                </div>

                {/* Type */}
                <div className="form-group">
                    <label className="form-label">Deployment Type *</label>
                    <select
                        name="type"
                        className="select"
                        value={formData.type}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        {deploymentTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                {/* Start Date */}
                <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                        type="date"
                        name="startDate"
                        className="input"
                        value={formData.startDate}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.startDate && <span className="form-error">{errors.startDate}</span>}
                </div>

                {/* End Date */}
                <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input
                        type="date"
                        name="endDate"
                        className="input"
                        value={formData.endDate}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.endDate && <span className="form-error">{errors.endDate}</span>}
                </div>

                {/* Description (formerly Location) */}
                <div className="form-group">
                    <label className="form-label">Description *</label>
                    <input
                        type="text"
                        name="location"
                        className="input"
                        placeholder="e.g., Patrol Operations"
                        value={formData.location}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.location && <span className="form-error">{errors.location}</span>}
                </div>

                {/* Status */}
                <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                        name="status"
                        className="select"
                        value={formData.status}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        {statuses.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Financial Information */}
            <div style={{
                marginTop: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-lg)',
                padding: 'var(--spacing-lg)',
                backgroundColor: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <h4 style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                        Financial Information
                    </h4>
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                        Estimated Total: <strong style={{ color: 'var(--color-primary)' }}>${calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </span>
                </div>

                {durationWarning && (
                    <div style={{
                        marginBottom: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.9rem'
                    }}>
                        ⚠️ {durationWarning}
                    </div>
                )}

                <div className="grid grid-cols-3" style={{ gap: 'var(--spacing-md)' }}>
                    {/* Show 15-Day CLINs for both types */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">15-Day CLINs ($)</label>
                        <input
                            type="number"
                            name="clins15Day"
                            className="input"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={formData.clins15Day}
                            onChange={handleChange}
                            disabled={!canEdit}
                        />
                    </div>

                    {/* Show 1-Day CLINs only for Ship */}
                    {formData.type === 'Ship' && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">1-Day CLINs ($)</label>
                            <input
                                type="number"
                                name="clins1Day"
                                className="input"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                value={formData.clins1Day}
                                onChange={handleChange}
                                disabled={!canEdit}
                            />
                        </div>
                    )}

                    {/* Show Over & Above only for Shore */}
                    {formData.type === 'Shore' && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Over & Above ($)</label>
                            <input
                                type="number"
                                name="overAndAbove"
                                className="input"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                value={formData.overAndAbove}
                                onChange={handleChange}
                                disabled={!canEdit}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Equipment */}
            <div className="form-group">
                <label className="form-label">Equipment</label>
                <input
                    type="text"
                    name="equipment"
                    className="input"
                    placeholder="Comma-separated equipment IDs"
                    value={formData.equipment}
                    onChange={handleChange}
                    disabled={!canEdit}
                />
                <span className="form-help">Separate multiple equipment IDs with commas</span>
            </div>

            {/* Notes */}
            <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                    name="notes"
                    className="textarea"
                    placeholder="Additional notes or comments"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    disabled={!canEdit}
                />
            </div>

            {/* Form Actions */}
            <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    <X size={18} />
                    Close
                </button>
                {canEdit && (
                    <button type="submit" className="btn btn-primary">
                        <Save size={18} />
                        {deployment ? 'Update Deployment' : 'Add Deployment'}
                    </button>
                )}
                {!canEdit && (
                    <span style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--color-text-muted)', marginLeft: '1rem' }}>
                        Read Only Mode
                    </span>
                )}
            </div>
        </form>
    );
};

export default DeploymentForm;
