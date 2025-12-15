import React, { useState, useEffect } from 'react';
import { getAllDeployments } from '../db/deployments';
import { useAuth } from '../context/AuthContext';
import { Check, X } from 'lucide-react';

const EquipmentForm = ({ equipment, defaultDeploymentId, onSave, onCancel }) => {
    const { canEdit } = useAuth();
    const [deployments, setDeployments] = useState([]);

    // Initial State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0], // Default to today
        category: 'Aircraft',
        equipment: '',
        serialNumber: '',
        status: 'FMC',
        deploymentId: defaultDeploymentId || '',
        location: '',
        software: '',
        comments: ''
    });

    const [errors, setErrors] = useState({});

    const categories = ['Aircraft', 'Payloads', 'Launchers', 'GCS', 'Radios'];
    const statuses = [
        { value: 'FMC', label: 'FMC (Fully Mission Capable)', color: 'text-success' },
        { value: 'PMC', label: 'PMC (Partially Mission Capable)', color: 'text-warning' },
        { value: 'NMC', label: 'NMC (Not Mission Capable)', color: 'text-error' },
        { value: 'CAT5', label: 'CAT5 (Out of Service)', color: 'text-muted' }
    ];

    // Load Deployments
    useEffect(() => {
        const loadVars = async () => {
            try {
                const data = await getAllDeployments();
                // Sort active first
                data.sort((a, b) => (a.status === 'Active' ? -1 : 1));
                setDeployments(data);
            } catch (error) {
                console.error('Error loading deployments:', error);
            }
        };
        loadVars();
    }, []);

    // Load Equipment Data if Editing
    useEffect(() => {
        if (equipment) {
            setFormData({
                date: equipment.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                category: equipment.category || 'Aircraft',
                equipment: equipment.equipment || '',
                serialNumber: equipment.serialNumber || '',
                status: equipment.status || 'FMC',
                deploymentId: equipment.deploymentId || defaultDeploymentId || '',
                location: equipment.location || '',
                software: equipment.software || '',
                comments: equipment.comments || ''
            });
        } else if (defaultDeploymentId) {
            setFormData(prev => ({ ...prev, deploymentId: defaultDeploymentId }));
        }
    }, [equipment, defaultDeploymentId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.date) newErrors.date = 'Date is required';
        if (!formData.equipment) newErrors.equipment = 'Equipment name is required';
        if (!formData.serialNumber) newErrors.serialNumber = 'Serial number is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

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
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                    <label className="form-label">Date <span className="text-error">*</span></label>
                    <input
                        type="date"
                        name="date"
                        className={`input w-full ${errors.date ? 'border-error' : ''}`}
                        value={formData.date}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.date && <span className="text-xs text-error mt-1">{errors.date}</span>}
                </div>

                {/* Category */}
                <div>
                    <label className="form-label">Category <span className="text-error">*</span></label>
                    <select
                        name="category"
                        className="select w-full"
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
                <div>
                    <label className="form-label">Equipment Name <span className="text-error">*</span></label>
                    <input
                        type="text"
                        name="equipment"
                        placeholder="e.g. V-BAT 128"
                        className={`input w-full ${errors.equipment ? 'border-error' : ''}`}
                        value={formData.equipment}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.equipment && <span className="text-xs text-error mt-1">{errors.equipment}</span>}
                </div>

                {/* Serial Number */}
                <div>
                    <label className="form-label">Serial Number <span className="text-error">*</span></label>
                    <input
                        type="text"
                        name="serialNumber"
                        placeholder="e.g. SN-1002"
                        className={`input w-full ${errors.serialNumber ? 'border-error' : ''}`}
                        value={formData.serialNumber}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.serialNumber && <span className="text-xs text-error mt-1">{errors.serialNumber}</span>}
                </div>

                {/* Status */}
                <div>
                    <label className="form-label">Status <span className="text-error">*</span></label>
                    <select
                        name="status"
                        className="select w-full"
                        value={formData.status}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        {statuses.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                {/* Deployment */}
                <div>
                    <label className="form-label">Assigned Deployment</label>
                    <select
                        name="deploymentId"
                        className="select w-full"
                        value={formData.deploymentId}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        <option value="">-- No Deployment --</option>
                        {deployments.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.name} {d.status === 'Active' ? '(Active)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Location */}
                <div>
                    <label className="form-label">Location / Storage</label>
                    <input
                        type="text"
                        name="location"
                        placeholder="e.g. Hangar Deck"
                        className="input w-full"
                        value={formData.location}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                </div>

                {/* Software */}
                <div>
                    <label className="form-label">Software Version</label>
                    <input
                        type="text"
                        name="software"
                        placeholder="e.g. v2.1.4"
                        className="input w-full"
                        value={formData.software}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                </div>
            </div>

            {/* Comments */}
            <div>
                <label className="form-label">Comments / Issues</label>
                <textarea
                    name="comments"
                    rows="3"
                    className="input w-full"
                    placeholder="Describe any mechanical issues or maintenance notes..."
                    value={formData.comments}
                    onChange={handleChange}
                    disabled={!canEdit}
                ></textarea>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    <X size={18} className="mr-2" />
                    Cancel
                </button>
                {canEdit && (
                    <button type="submit" className="btn btn-primary">
                        <Check size={18} className="mr-2" />
                        {equipment ? 'Update Equipment' : 'Add Equipment'}
                    </button>
                )}
            </div>
        </form>
    );
};

export default EquipmentForm;
