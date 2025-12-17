import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../db/schema'; // Import db for user sync logic

const DeploymentForm = ({ deployment, onSave, onCancel }) => {
    const { canEdit } = useAuth();
    const { deployerWarning } = useDeployment();

    const [formData, setFormData] = useState({
        name: '',
        type: 'Shore',
        startDate: '',
        endDate: '',
        location: '',
        equipment: '',
        userEmails: '',
        status: 'Planning',
        notes: ''
    });

    const [errors, setErrors] = useState({});

    // State for managing new email input
    const [newEmail, setNewEmail] = useState('');

    useEffect(() => {
        if (deployment) {
            setFormData({
                name: deployment.name || '',
                type: deployment.type || 'Shore',
                startDate: deployment.startDate?.split('T')[0] || '',
                endDate: deployment.endDate?.split('T')[0] || '',
                location: deployment.location || '',
                equipment: deployment.equipment?.join(', ') || '',
                userEmails: deployment.userEmails?.join(', ') || '',
                status: deployment.status || 'Planning',
                notes: deployment.notes || ''
            });
        }
    }, [deployment]);

    const deploymentTypes = ['Shore', 'Ship'];
    const statuses = ['Planning', 'Active', 'Completed', 'Cancelled'];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleAddEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) return; // Basic validation

        const emailToAdd = newEmail.trim().toLowerCase();

        // 1. Add to Form Data List
        const currentList = formData.userEmails
            ? (Array.isArray(formData.userEmails) ? formData.userEmails : String(formData.userEmails).split(',').filter(e => e))
            : [];

        if (!currentList.includes(emailToAdd)) {
            const updatedList = [...currentList, emailToAdd];
            setFormData(prev => ({ ...prev, userEmails: updatedList }));

            // 2. SYNC LOGIC: Check/Add to Admin Portal (db.users)
            try {
                const existingUser = await db.users.where('email').equals(emailToAdd).first();
                if (!existingUser) {
                    await db.users.add({
                        email: emailToAdd,
                        role: 'Sitrep.Deployer',
                        addedBy: 'System (Deployment Form)',
                        createdAt: new Date().toISOString()
                    });
                    console.log(`Auto-added ${emailToAdd} as Deployer to Admin Portal`);
                }
            } catch (err) {
                console.error("Failed to sync deployer to admin portal", err);
            }
        }

        setNewEmail(''); // Reset input
    };

    const handleRemoveEmail = (emailToRemove) => {
        const currentList = Array.isArray(formData.userEmails)
            ? formData.userEmails
            : String(formData.userEmails).split(',').filter(e => e);

        setFormData(prev => ({
            ...prev,
            userEmails: currentList.filter(e => e !== emailToRemove)
        }));
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
            userEmails: formData.userEmails
                ? (Array.isArray(formData.userEmails) ? formData.userEmails : String(formData.userEmails).split(',').filter(e => e))
                : [],
            status: formData.status,
            notes: formData.notes
        };

        onSave(deploymentData);
    };

    return (
        <form onSubmit={handleSubmit}>
            {deployerWarning && (
                <div className="mb-6 p-4 bg-warning/20 border border-warning/50 rounded-lg flex items-center gap-3 text-warning">
                    <span className="font-bold">Warning: Multiple active deployments detected. Ensure you are editing the correct one.</span>
                </div>
            )}
            <div className="grid grid-cols-2" style={{ gap: 'var(--spacing-lg)' }}>
                {/* Ship/Location (formerly Deployment Name) */}
                <div className="form-group">
                    <label className="form-label">Ship/Location *</label>
                    <input
                        type="text"
                        name="name"
                        className="input"
                        placeholder="e.g., DEPLOYMENT LOCATION / Operation Name"
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

            {/* Equipment */}
            <div className="form-group" style={{ marginTop: 'var(--spacing-lg)' }}>
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

            {/* Authorized Deployers */}
            <div className="form-group">
                <label className="form-label">Authorized Deployers</label>

                {/* Add New Input */}
                <div className="flex gap-2 mb-2">
                    <input
                        type="email"
                        className="input"
                        placeholder="user@shield.ai"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddEmail();
                            }
                        }}
                        disabled={!canEdit}
                    />
                    <button type="button" className="btn btn-secondary" onClick={handleAddEmail} disabled={!canEdit}>
                        Add
                    </button>
                </div>

                {/* List View */}
                <div className="space-y-1">
                    {(() => {
                        const list = Array.isArray(formData.userEmails)
                            ? formData.userEmails
                            : (formData.userEmails ? String(formData.userEmails).split(',').filter(e => e) : []);

                        if (list.length === 0) return <div className="text-sm text-muted italic">No deployers assigned.</div>;

                        return list.map((email, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-secondary p-2 rounded-md text-sm border border-border">
                                <span>{email}</span>
                                {canEdit && (
                                    <button
                                        type="button"
                                        className="text-muted hover:text-error transition-colors"
                                        onClick={() => handleRemoveEmail(email)}
                                        title="Remove"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ));
                    })()}
                </div>

                <span className="form-help mt-1 block">Users added here will automatically be granted Deployer access if they don't have it.</span>
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
