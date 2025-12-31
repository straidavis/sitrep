import React, { useState, useEffect, useMemo } from 'react';
import { getAllServiceBulletins, addServiceBulletin, updateServiceBulletin, deleteServiceBulletin } from '../db/serviceBulletins';
import { getAllEquipment } from '../db/equipment';
import { getInventoryItems } from '../db/inventory';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import Modal from '../components/Modal';
import {
    AlertTriangle, CheckCircle, Search, Plus, Filter,
    ChevronDown, ChevronUp, FileText, Calendar,
    ExternalLink, X, Edit, Trash2, Save
} from 'lucide-react';
import { format } from 'date-fns';

const ServiceBulletins = () => {
    const { selectedDeploymentIds, deployments } = useDeployment();
    const { user, roles } = useAuth();

    // Derived state
    const currentDeploymentId = (selectedDeploymentIds?.length === 1) ? parseInt(selectedDeploymentIds[0]) : null;
    const isMultiView = !currentDeploymentId;

    // State
    const [bulletins, setBulletins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'open', 'compliance_needed', 'closed'
    const [searchQuery, setSearchQuery] = useState('');

    // Editor State
    const [isEditting, setIsEditting] = useState(false);
    const [currentBulletin, setCurrentBulletin] = useState(null);
    const [complianceItems, setComplianceItems] = useState([]); // Array of linked equipment/inventory

    // Lookups
    const [equipmentLookup, setEquipmentLookup] = useState([]);
    const [inventoryLookup, setInventoryLookup] = useState([]);

    // --- Loading ---
    const loadData = async () => {
        setIsLoading(true);
        try {
            const allBulletins = await getAllServiceBulletins();

            if (currentDeploymentId) {
                setBulletins(allBulletins.filter(b => b.deploymentId === currentDeploymentId));
            } else {
                setBulletins(allBulletins);
            }

            // Pre-load lookups for search
            if (isEditting) {
                const equip = await getAllEquipment();
                const inv = await getInventoryItems();
                setEquipmentLookup(equip);
                setInventoryLookup(inv);
            }

        } catch (error) {
            console.error("Failed to load service bulletins", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentDeploymentId, isEditting]); // Reload when entering edit mode to get up-to-date lookups

    // --- Filtering ---
    const filteredBulletins = useMemo(() => {
        let result = bulletins;

        // Status Filter
        if (filterStatus !== 'all') {
            const now = new Date();
            if (filterStatus === 'open') {
                result = result.filter(b => b.status === 'Open');
            } else if (filterStatus === 'closed') {
                result = result.filter(b => b.status === 'Closed');
            } else if (filterStatus === 'compliance_needed') {
                // Logic: Open + checks logic (simplified here)
                result = result.filter(b => b.status === 'Open');
            }
        }

        // Search Filter
        if (searchQuery) {
            const term = searchQuery.toLowerCase();
            result = result.filter(b =>
                b.title.toLowerCase().includes(term) ||
                b.sbNumber.toLowerCase().includes(term) ||
                (b.description || '').toLowerCase().includes(term)
            );
        }

        return result;
    }, [bulletins, filterStatus, searchQuery]);

    // --- Actions ---
    const handleCreate = () => {
        setCurrentBulletin({
            deploymentId: currentDeploymentId || '',
            status: 'Open',
            complianceLevel: 'Mandatory',
            dateIssued: new Date().toISOString().split('T')[0]
        });
        setComplianceItems([]);
        setIsEditting(true);
    };

    const handleEdit = (sb) => {
        setCurrentBulletin(sb);
        setComplianceItems(sb.effectedEquipment || []); // Assume effectedEquipment is stored as JSON array in adapter
        setIsEditting(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this Service Bulletin?')) {
            await deleteServiceBulletin(id);
            loadData();
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            const sbData = {
                sbNumber: formData.get('sbNumber'),
                title: formData.get('title'),
                description: formData.get('description'),
                complianceLevel: formData.get('complianceLevel'),
                dateIssued: formData.get('dateIssued'),
                deadlineDate: formData.get('deadlineDate') || null,
                status: formData.get('status'),
                deploymentId: parseInt(formData.get('deploymentId')),
                effectedEquipment: complianceItems, // Store linked items
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: user?.name || 'Unknown'
            };

            if (currentBulletin?.id) {
                await updateServiceBulletin(currentBulletin.id, sbData, user);
            } else {
                sbData.createdAt = new Date().toISOString();
                await addServiceBulletin(sbData, user);
            }

            setIsEditting(false);
            setCurrentBulletin(null);
            loadData();

        } catch (error) {
            console.error("Save Error", error);
            alert("Failed to save Service Bulletin");
        }
    };

    // --- Compliance Item Management (Search & Add) ---
    const [itemSearch, setItemSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const handleSearchItems = async (term) => {
        setItemSearch(term);
        if (!term || term.length < 2) {
            setSearchResults([]);
            return;
        }

        const lowerTerm = term.toLowerCase();

        // Use loaded lookups, filtering in memory
        // Equipment
        const equipMatches = equipmentLookup
            .filter(e =>
                (!currentBulletin.deploymentId || e.deploymentId === parseInt(currentBulletin.deploymentId)) &&
                ((e.equipment || '').toLowerCase().includes(lowerTerm) ||
                    (e.serialNumber || '').toLowerCase().includes(lowerTerm))
            )
            .slice(0, 10);

        // Inventory
        const invMatches = inventoryLookup
            .filter(i =>
                (!currentBulletin.deploymentId || i.deploymentId === parseInt(currentBulletin.deploymentId)) &&
                ((i.description || '').toLowerCase().includes(lowerTerm) ||
                    (i.partNumber || '').toLowerCase().includes(lowerTerm))
            )
            .slice(0, 10);

        const formattedEquip = equipMatches.map(e => ({
            id: `EQ-${e.id}`,
            type: 'Equipment',
            identifier: e.serialNumber || 'N/A',
            name: e.equipment,
            refId: e.id
        }));

        const formattedInv = invMatches.map(i => ({
            id: `INV-${i.id}`,
            type: 'Inventory',
            identifier: i.partNumber,
            name: i.description,
            refId: i.id
        }));

        setSearchResults([...formattedEquip, ...formattedInv]);
    };

    const addComplianceItem = (item) => {
        if (complianceItems.some(i => i.id === item.id)) return;
        setComplianceItems([...complianceItems, { ...item, status: 'Pending', notes: '' }]);
        setItemSearch('');
        setSearchResults([]);
    };

    const removeComplianceItem = (index) => {
        setComplianceItems(complianceItems.filter((_, i) => i !== index));
    };

    const updateComplianceItem = (index, field, val) => {
        const newItems = [...complianceItems];
        newItems[index] = { ...newItems[index], [field]: val };
        setComplianceItems(newItems);
    };


    // --- Renderers ---

    // Safe date formatter
    const safeFormat = (dateStr) => {
        try {
            if (!dateStr) return 'N/A';
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return format(date, 'MMM d, yyyy');
        } catch (e) {
            return 'Error';
        }
    };

    const renderList = () => (
        <div className="grid grid-cols-1 gap-4">
            {filteredBulletins.map(sb => (
                <div key={sb.id} className="card bg-base-100 shadow-sm border border-base-200 hover:border-primary/50 transition-colors">
                    <div className="card-body p-4">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-4 items-start">
                                <div className={`p-3 rounded-lg ${sb.complianceLevel === 'Mandatory' ? 'bg-error/10 text-error' :
                                    sb.complianceLevel === 'Recommended' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'
                                    }`}>
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono font-bold text-sm bg-base-300 px-2 py-0.5 rounded">{sb.sbNumber}</span>
                                        {sb.status === 'Closed' ?
                                            <span className="badge badge-success badge-sm gap-1"><CheckCircle size={10} /> Closed</span> :
                                            <span className="badge badge-warning badge-sm">Open</span>
                                        }
                                        <span className="text-xs text-muted">
                                            {deployments.find(d => d.id === sb.deploymentId)?.name}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-lg">{sb.title}</h3>
                                    <p className="text-sm text-muted line-clamp-2 mt-1">{sb.description}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="text-xs text-right">
                                    <div className="font-bold">Issued: {safeFormat(sb.issueDate)}</div>
                                    {sb.deadlineDate && (
                                        <div className="text-error">Deadline: {safeFormat(sb.deadlineDate)}</div>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(sb)}>
                                        <Edit size={16} />
                                    </button>
                                    <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDelete(sb.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar for Compliance */}
                        {sb.effectedEquipment && sb.effectedEquipment.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-base-200">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-bold">Compliance Progress</span>
                                    <span>
                                        {sb.effectedEquipment.filter(i => i.status === 'Compliant').length} / {sb.effectedEquipment.length} Items
                                    </span>
                                </div>
                                <progress
                                    className="progress progress-success w-full"
                                    value={sb.effectedEquipment.filter(i => i.status === 'Compliant').length}
                                    max={sb.effectedEquipment.length}
                                ></progress>
                            </div>
                        )}
                    </div>
                </div>
            ))}
            {filteredBulletins.length === 0 && (
                <div className="text-center py-12 text-muted bg-base-100 rounded-lg border border-dashed border-base-300">
                    <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No Service Bulletins found matching filters.</p>
                </div>
            )}
        </div>
    );

    const renderEditor = () => (
        <div className="card bg-base-100 shadow-lg">
            <div className="card-header border-b border-base-200">
                <h3 className="card-title">{currentBulletin?.id ? 'Edit Service Bulletin' : 'New Service Bulletin'}</h3>
            </div>
            <div className="card-body">
                <form onSubmit={handleSave}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-4">
                            <div className="form-control">
                                <label className="label">SB Number / Reference</label>
                                <input name="sbNumber" defaultValue={currentBulletin?.sbNumber} className="input font-mono" required placeholder="e.g. SB-2023-001" />
                            </div>
                            <div className="form-control">
                                <label className="label">Title</label>
                                <input name="title" defaultValue={currentBulletin?.title} className="input" required placeholder="Bulletin Title" />
                            </div>
                            <div className="form-control">
                                <label className="label">Deployment</label>
                                <select name="deploymentId" defaultValue={currentBulletin?.deploymentId} className="select" required>
                                    <option value="">Select Deployment...</option>
                                    {deployments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-control">
                                    <label className="label">Date Issued</label>
                                    <input type="date" name="dateIssued" defaultValue={currentBulletin?.dateIssued} className="input" required />
                                </div>
                                <div className="form-control">
                                    <label className="label">Deadline (Optional)</label>
                                    <input type="date" name="deadlineDate" defaultValue={currentBulletin?.deadlineDate} className="input" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-control">
                                    <label className="label">Compliance Level</label>
                                    <select name="complianceLevel" defaultValue={currentBulletin?.complianceLevel} className="select">
                                        <option value="Mandatory">Mandatory</option>
                                        <option value="Recommended">Recommended</option>
                                        <option value="Informational">Informational</option>
                                    </select>
                                </div>
                                <div className="form-control">
                                    <label className="label">Status</label>
                                    <select name="status" defaultValue={currentBulletin?.status} className="select">
                                        <option value="Open">Open</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-control mb-6">
                        <label className="label">Description / Instructions</label>
                        <textarea name="description" defaultValue={currentBulletin?.description} className="textarea h-24" placeholder="Details..."></textarea>
                    </div>

                    <div className="divider">Affected Items & Compliance</div>

                    <div className="mb-4">
                        <div className="form-control relative">
                            <label className="label">Add Equipment or Inventory Item</label>
                            <div className="flex gap-2">
                                <input
                                    className="input w-full"
                                    placeholder="Search by name, serial, or part number..."
                                    value={itemSearch}
                                    onChange={(e) => handleSearchItems(e.target.value)}
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <ul className="menu bg-base-200 w-full rounded-box mt-1 absolute z-10 shadow-lg max-h-60 overflow-y-auto">
                                    {searchResults.map((res, idx) => (
                                        <li key={res.id || `search-res-${idx}`}>
                                            <a onClick={() => addComplianceItem(res)} className="flex justify-between">
                                                <span>
                                                    <span className="font-bold">{res.identifier}</span>
                                                    <span className="mx-2 opacity-50">|</span>
                                                    {res.name}
                                                </span>
                                                <span className="badge badge-sm">{res.type}</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto mb-8 bg-base-200/50 rounded-lg p-2">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Identifier</th>
                                    <th>Name</th>
                                    <th>Compliance Status</th>
                                    <th>Notes</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {complianceItems.map((item, idx) => (
                                    <tr key={idx}>
                                        <td><span className="badge badge-sm badge-ghost">{item.type}</span></td>
                                        <td className="font-mono font-bold">{item.identifier}</td>
                                        <td>{item.name}</td>
                                        <td>
                                            <select
                                                className={`select select-xs w-full max-w-[120px] ${item.status === 'Compliant' ? 'select-success' :
                                                    item.status === 'NA' ? 'select-ghost' : 'select-warning'
                                                    }`}
                                                value={item.status}
                                                onChange={(e) => updateComplianceItem(idx, 'status', e.target.value)}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Compliant">Compliant</option>
                                                <option value="NA">N/A</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                className="input input-xs w-full"
                                                placeholder="Notes..."
                                                value={item.notes || ''}
                                                onChange={(e) => updateComplianceItem(idx, 'notes', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removeComplianceItem(idx)}>
                                                <X size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {complianceItems.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="text-center text-muted italic p-4">
                                            No items linked. Add items above to track compliance.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button type="button" className="btn btn-ghost" onClick={() => setIsEditting(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary gap-2">
                            <Save size={16} /> Save Bulletin
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 container mx-auto p-6 max-w-6xl">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Service Bulletins</h1>
                    <p className="text-muted">Track mandatory inspections and retrofits across the fleet.</p>
                </div>
                {!isEditting && (
                    <button className="btn btn-primary gap-2" onClick={handleCreate}>
                        <Plus size={18} /> New Bulletin
                    </button>
                )}
            </div>

            {!isEditting && (
                <div className="flex gap-4 items-center bg-base-100 p-4 rounded-lg shadow-sm border border-base-200">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 text-muted" size={18} />
                        <input
                            className="input w-full pl-10"
                            placeholder="Search bulletins..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="join">
                        <button
                            className={`join-item btn ${filterStatus === 'all' ? 'btn-active' : ''}`}
                            onClick={() => setFilterStatus('all')}
                        >All</button>
                        <button
                            className={`join-item btn ${filterStatus === 'open' ? 'btn-active' : ''}`}
                            onClick={() => setFilterStatus('open')}
                        >Open</button>
                        <button
                            className={`join-item btn ${filterStatus === 'closed' ? 'btn-active' : ''}`}
                            onClick={() => setFilterStatus('closed')}
                        >Closed</button>
                    </div>
                </div>
            )}

            {isEditting ? renderEditor() : renderList()}
        </div>
    );
};

export default ServiceBulletins;
