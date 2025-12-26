import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { getAllServiceBulletins, addServiceBulletin, updateServiceBulletin, deleteServiceBulletin } from '../db/serviceBulletins';
import { getAllEquipment } from '../db/equipment';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import Modal from '../components/Modal';
import { Plus, Search, Trash2, Edit, ExternalLink, Filter, Save, AlertTriangle, X } from 'lucide-react';

const STATUS_OPTIONS = ['Not Complete', 'Partial', 'Complete', 'N/A'];
const STATUS_COLORS = {
    'Not Complete': 'bg-error/20 text-error',
    'Partial': 'bg-warning/20 text-warning',
    'Complete': 'bg-success/20 text-success',
    'N/A': 'bg-base-200 text-muted'
};

const getComplianceStatus = (sb, deploymentId) => {
    // If deployment is not in applicable list, return N/A
    if (sb.applicableDeploymentIds && !sb.applicableDeploymentIds.includes(deploymentId)) {
        return 'N/A';
    }

    const items = (sb.effectedEquipment || []).filter(i => i.deploymentId === deploymentId);
    if (items.length === 0) return 'No Items';

    const completed = items.filter(i => i.completed).length;
    if (completed === items.length) return 'Complete';
    if (completed > 0) return 'Partial';
    return 'Not Complete';
};

const formatDate = (isoString) => {
    if (!isoString) return '-';
    // If it's a simple date string (YYYY-MM-DD), parse as local date components to avoid timezone shift
    if (typeof isoString === 'string' && isoString.length === 10) {
        const [y, m, d] = isoString.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' });
    }
    return new Date(isoString).toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' });
};

const ServiceBulletins = () => {
    const { user, canEdit } = useAuth();
    const { deployments } = useDeployment(); // Using context to get deployments

    // Local State
    const [sbs, setSbs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSb, setEditingSb] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Compliance Modal
    const [complianceModalOpen, setComplianceModalOpen] = useState(false);
    const [selectedSbForCompliance, setSelectedSbForCompliance] = useState(null);
    const [selectedDeploymentForCompliance, setSelectedDeploymentForCompliance] = useState(null);

    // Fetch Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getAllServiceBulletins();
            setSbs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Active Deployments for Columns
    const activeDeployments = useMemo(() => {
        return deployments.filter(d => d.status !== 'Completed' && d.status !== 'Cancelled').sort((a, b) => a.name.localeCompare(b.name));
    }, [deployments]);

    // Handlers
    const handleAdd = () => {
        setEditingSb(null);
        setIsModalOpen(true);
    };

    const handleEdit = (sb) => {
        setEditingSb(sb);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this Service Bulletin?')) return;
        try {
            await deleteServiceBulletin(id);
            await loadData();
        } catch (error) {
            console.error(error);
            alert('Failed to delete SB.');
        }
    };

    const handleSaveForm = async (formData) => {
        try {
            if (editingSb) {
                await updateServiceBulletin(editingSb.id, formData, user);
            } else {
                await addServiceBulletin({ ...formData, deploymentStatus: {} }, user);
            }
            setIsModalOpen(false);
            loadData();
        } catch (error) {
            console.error(error);
            alert('Failed to save Service Bulletin.');
        }
    };

    const handleOpenCompliance = (sb, deploymentId) => {
        setSelectedSbForCompliance(sb);
        setSelectedDeploymentForCompliance(deploymentId);
        setComplianceModalOpen(true);
    };

    const handleSaveCompliance = async (updatedEquipment) => {
        try {
            const sb = selectedSbForCompliance;
            // Update the equipment list for this SB
            // We need to merge the updated items for this deployment with items from other deployments
            const otherItems = sb.effectedEquipment.filter(i => i.deploymentId !== selectedDeploymentForCompliance);
            const newEffectedEquipment = [...otherItems, ...updatedEquipment];

            await updateServiceBulletin(sb.id, { effectedEquipment: newEffectedEquipment }, user);

            // Optimistic update
            setSbs(prev => prev.map(s => s.id === sb.id ? { ...s, effectedEquipment: newEffectedEquipment } : s));

            setComplianceModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save compliance status.');
        }
    };

    // Filtering
    const filteredSbs = useMemo(() => {
        return sbs.filter(sb =>
            sb.sbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sb.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sb.effectedEquipment || []).some(eq => eq.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [sbs, searchTerm]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Service Bulletins</h1>
                    <p className="text-muted">Manage Service Bulletins and track compliance across deployments.</p>
                </div>
                {canEdit && (
                    <button onClick={handleAdd} className="btn btn-primary">
                        <Plus size={18} className="mr-2" />
                        Add Service Bulletin
                    </button>
                )}
            </div>

            {/* Controls */}
            <div className="flex gap-4 items-center bg-bg-secondary p-4 rounded-lg border border-border">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input
                        type="text"
                        className="input pl-10 w-full"
                        placeholder="Search SB Number, Description, or Equipment..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-border bg-bg-secondary">
                <table className="table w-full">
                    <thead>
                        <tr>
                            <th className="w-24">Date Issued</th>
                            <th className="w-32">SB Number</th>
                            <th className="min-w-[200px]">Description</th>
                            <th className="min-w-[150px]">Notes</th>
                            {activeDeployments.map(d => (
                                <th key={d.id} className="min-w-[140px] text-center whitespace-nowrap">
                                    {d.name}
                                </th>
                            ))}
                            <th className="w-32">Last Updated</th>
                            {canEdit && <th className="w-20 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={10} className="text-center p-8">Loading...</td></tr>
                        ) : filteredSbs.length === 0 ? (
                            <tr><td colSpan={10} className="text-center p-8 text-muted">No Service Bulletins found.</td></tr>
                        ) : (
                            filteredSbs.map(sb => (
                                <tr key={sb.id} className="group hover:bg-base-200/50">
                                    <td className="text-sm font-mono text-muted">{formatDate(sb.dateIssued)}</td>
                                    <td className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {sb.link ? (
                                                <a href={sb.link} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline flex items-center gap-1">
                                                    {sb.sbNumber}
                                                    <ExternalLink size={12} />
                                                </a>
                                            ) : (
                                                sb.sbNumber
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="font-medium line-clamp-2" title={sb.description}>{sb.description}</div>
                                    </td>
                                    <td>
                                        <div className="text-xs text-muted line-clamp-2" title={sb.notes}>{sb.notes || '-'}</div>
                                    </td>
                                    {activeDeployments.map(d => {
                                        const status = getComplianceStatus(sb, d.id);
                                        const isApplicable = !sb.applicableDeploymentIds || sb.applicableDeploymentIds.includes(d.id);
                                        const items = (sb.effectedEquipment || []).filter(e => e.deploymentId === d.id);
                                        const completedCount = items.filter(e => e.completed).length;

                                        return (
                                            <td key={d.id} className="p-2 text-center">
                                                {!isApplicable ? (
                                                    <span className="text-xs text-muted/50 font-mono">N/A</span>
                                                ) : (
                                                    <button
                                                        onClick={() => canEdit ? handleOpenCompliance(sb, d.id) : null}
                                                        className={`btn btn-xs w-full h-8 border-none normal-case ${STATUS_COLORS[status] || 'bg-base-200'}`}
                                                        disabled={!canEdit}
                                                        title={items.length > 0 ? `${completedCount}/${items.length} Items Complete` : 'No items linked'}
                                                    >
                                                        {status === 'No Items' ? '-' : status}
                                                        {items.length > 0 && status !== 'Complete' && status !== 'Not Complete' && (
                                                            <span className="ml-1 text-[10px] opacity-80">({completedCount}/{items.length})</span>
                                                        )}
                                                        {status === 'Complete' && (
                                                            <span className="ml-1 text-[10px] opacity-80">
                                                                {/* Show completion date if available (max of item dates) */}
                                                                {(() => {
                                                                    const dates = items.map(i => i.complianceDate).filter(Boolean).sort();
                                                                    const last = dates[dates.length - 1];
                                                                    return last ? formatDate(last) : '';
                                                                })()}
                                                            </span>
                                                        )}
                                                    </button>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="text-xs text-muted">
                                        <div className="flex flex-col">
                                            <span>{new Date(sb.updatedAt).toLocaleDateString()}</span>
                                            <span>{sb.lastUpdatedBy}</span>
                                        </div>
                                    </td>
                                    {canEdit && (
                                        <td className="text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(sb)} className="btn btn-xs btn-ghost" title="Edit">
                                                    <Edit size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(sb.id)} className="btn btn-xs btn-ghost text-error" title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingSb ? "Edit Service Bulletin" : "Add Service Bulletin"}
                size="lg"
            >
                <SBForm
                    initialData={editingSb}
                    onSave={handleSaveForm}
                    onCancel={() => setIsModalOpen(false)}
                    deployments={activeDeployments}
                />
            </Modal>

            {/* Compliance Modal */}
            <Modal
                isOpen={complianceModalOpen}
                onClose={() => setComplianceModalOpen(false)}
                title={`Compliance Tracking: ${selectedDeploymentForCompliance && deployments.find(d => d.id === selectedDeploymentForCompliance)?.name}`}
                size="lg"
            >
                {selectedSbForCompliance && selectedDeploymentForCompliance && (
                    <ComplianceChecklist
                        sb={selectedSbForCompliance}
                        deploymentId={selectedDeploymentForCompliance}
                        onSave={handleSaveCompliance}
                        onCancel={() => setComplianceModalOpen(false)}
                    />
                )}
            </Modal>
        </div>
    );
};

// --- Form Component ---
const SBForm = ({ initialData, onSave, onCancel, deployments }) => {
    const [formData, setFormData] = useState({
        sbNumber: '',
        dateIssued: new Date().toISOString().split('T')[0],
        description: '',
        link: '',
        notes: '',
        applicableDeploymentIds: [],
        effectedEquipment: []
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                sbNumber: initialData.sbNumber || '',
                dateIssued: initialData.dateIssued || new Date().toISOString().split('T')[0],
                description: initialData.description || '',
                link: initialData.link || '',
                notes: initialData.notes || '',
                applicableDeploymentIds: initialData.applicableDeploymentIds || [],
                effectedEquipment: initialData.effectedEquipment || []
            });
        }
    }, [initialData]);

    const toggleDeployment = (depId) => {
        setFormData(prev => {
            const current = prev.applicableDeploymentIds || [];
            if (current.includes(depId)) {
                return { ...prev, applicableDeploymentIds: current.filter(id => id !== depId) };
            } else {
                return { ...prev, applicableDeploymentIds: [...current, depId] };
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group">
                    <label className="form-label">SB Number *</label>
                    <input
                        type="text"
                        className="input w-full"
                        value={formData.sbNumber}
                        onChange={e => setFormData({ ...formData, sbNumber: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Date Issued *</label>
                    <input
                        type="date"
                        className="input w-full"
                        value={formData.dateIssued}
                        onChange={e => setFormData({ ...formData, dateIssued: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Link to SB</label>
                    <input
                        type="url"
                        className="input w-full"
                        placeholder="https://..."
                        value={formData.link}
                        onChange={e => setFormData({ ...formData, link: e.target.value })}
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Description *</label>
                <input
                    type="text"
                    className="input w-full"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    required
                />
            </div>

            <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                    className="input w-full h-24 py-2"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
            </div>

            {/* Deployments Selector */}
            <div className="form-group">
                <label className="form-label">Applicable Deployments</label>
                <div className="text-xs text-muted mb-2">Select which deployments this Service Bulletin applies to. Equipment management is handled in the main dashboard view.</div>
                <div className="flex flex-wrap gap-2">
                    {deployments.map(d => (
                        <label key={d.id} className="cursor-pointer label border border-border rounded p-2 hover:bg-base-200">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm checkbox-primary mr-2"
                                checked={(formData.applicableDeploymentIds || []).includes(d.id)}
                                onChange={() => toggleDeployment(d.id)}
                            />
                            <span className="label-text">{d.name}</span>
                        </label>
                    ))}
                    {deployments.length === 0 && <span className="text-muted italic text-sm">No active deployments found.</span>}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">
                    <Save size={18} className="mr-2" />
                    Save Service Bulletin
                </button>
            </div>
        </form>
    );
};

// --- Compliance Checklist Component ---
// --- Compliance Checklist Component ---
const ComplianceChecklist = ({ sb, deploymentId, onSave, onCancel }) => {
    // Local State
    const [items, setItems] = useState(() => (sb.effectedEquipment || []).filter(i => i.deploymentId === deploymentId));
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Toggle Compliance
    const toggleItem = (itemId) => {
        setItems(prev => prev.map(i => {
            if (i.id === itemId) {
                const now = new Date().toISOString();
                return {
                    ...i,
                    completed: !i.completed,
                    complianceDate: !i.completed ? now : null // Set date if completing, clear if unchecking
                };
            }
            return i;
        }));
    };

    // Remove Item
    const removeItem = (itemId) => {
        if (confirm('Remove this equipment from the Service Bulletin?')) {
            setItems(prev => prev.filter(i => i.id !== itemId));
        }
    };

    // Add Item Search
    useEffect(() => {
        const search = async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const term = searchTerm.toLowerCase();

                // Search Equipment linked to this deployment
                const equip = await db.equipment
                    .where('deploymentId').equals(deploymentId)
                    .filter(e =>
                        (e.equipment || '').toLowerCase().includes(term) ||
                        (e.serialNumber || '').toLowerCase().includes(term))
                    .limit(10)
                    .toArray();

                // Search Inventory linked to this deployment
                const inventory = await db.inventoryItems
                    .where('deploymentId').equals(deploymentId)
                    .filter(i =>
                        (i.description || '').toLowerCase().includes(term) ||
                        (i.partNumber || '').toLowerCase().includes(term))
                    .limit(10)
                    .toArray();

                const formattedEquip = equip.map(e => ({
                    id: `EQ-${e.id}`,
                    realId: e.id,
                    name: `${e.equipment} (${e.serialNumber})`,
                    type: e.category,
                    deploymentId: e.deploymentId,
                    source: 'Equipment'
                }));

                const formattedInv = inventory.map(i => ({
                    id: `INV-${i.id}`,
                    realId: i.id,
                    name: `${i.description} (${i.partNumber})`,
                    type: i.category,
                    deploymentId: i.deploymentId,
                    source: 'Inventory'
                }));

                setSearchResults([...formattedEquip, ...formattedInv]);

            } catch (e) {
                console.error("Search failed", e);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(search, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, deploymentId]);

    const addItem = (item) => {
        if (items.some(i => i.id === item.id)) {
            alert('Item already added.');
            return;
        }
        setItems(prev => [...prev, { ...item, completed: false, complianceDate: null }]);
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleSave = () => {
        onSave(items);
    };

    const progress = items.length > 0 ? (items.filter(i => i.completed).length / items.length) * 100 : 0;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-border pb-2">
                <div>
                    <h3 className="font-bold text-lg">{sb.sbNumber}</h3>
                    <p className="text-sm text-muted">{sb.description}</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold font-mono">{Math.round(progress)}%</div>
                    <div className="text-xs text-muted">Complete</div>
                </div>
            </div>

            {/* Add Equipment Section */}
            <div className="bg-base-200 p-3 rounded-lg border border-border">
                <label className="text-xs font-bold uppercase text-muted mb-1 block">Add Effected Equipment</label>
                <div className="relative">
                    <div className="flex gap-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input
                            type="text"
                            className="input input-sm w-full pl-9"
                            placeholder="Search deployment equipment..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {searchTerm && (
                        <div className="absolute z-10 w-full mt-1 bg-bg-secondary border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {isSearching ? (
                                <div className="p-2 text-center text-muted text-sm">Searching...</div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="w-full text-left p-2 hover:bg-base-200 text-sm flex justify-between items-center"
                                        onClick={() => addItem(item)}
                                    >
                                        <span>{item.name}</span>
                                        <span className="text-xs text-muted badge badge-outline">{item.source}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="p-2 text-center text-muted text-sm">No results found</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {items.length === 0 ? (
                <div className="py-8 text-center text-muted border border-dashed rounded-lg">
                    No equipment linked to this deployment.<br />
                    <span className="text-xs">Search above to add items.</span>
                </div>
            ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-base-200 transition-colors group">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={!!item.completed}
                                onChange={() => toggleItem(item.id)}
                            />
                            <div className="flex-1">
                                <div className="font-semibold">{item.name}</div>
                                <div className="text-xs text-muted flex gap-2">
                                    <span>{item.source}</span>
                                    <span>•</span>
                                    <span>{item.type}</span>
                                    {item.completed && item.complianceDate && (
                                        <span className="text-success font-mono ml-2">
                                            Scale Applied: {new Date(item.complianceDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => removeItem(item.id)}
                                className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove item"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn btn-primary">Save Changes</button>
            </div>
        </div>
    );
};



export default ServiceBulletins;
