import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/schema';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import {
    Package, Plus, Search, Calendar, Truck,
    CheckCircle, AlertTriangle, X, Edit, Trash2,
    ChevronDown, ChevronUp, Save, MapPin
} from 'lucide-react';
import { format } from 'date-fns';

const PartsTracking = () => {
    const { selectedDeploymentIds, deployments } = useDeployment();
    const { user, roles } = useAuth();

    // Derive current
    const currentDeploymentId = (selectedDeploymentIds?.length === 1) ? parseInt(selectedDeploymentIds[0]) : null;
    const currentDeployment = deployments.find(d => d.id === currentDeploymentId);

    // State
    const [shipments, setShipments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState('list'); // 'list', 'edit', 'create'
    const [searchQuery, setSearchQuery] = useState('');

    // Editor State
    const [currentShipment, setCurrentShipment] = useState(null);
    const [shipmentItems, setShipmentItems] = useState([]);

    // Lookups
    const [inventoryLookup, setInventoryLookup] = useState([]);

    // --- Loading ---
    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load Shipments (filter by deployment if selected, or load all?)
            // Usually tracking is deployment specific
            let q = db.shipments.orderBy('orderDate').reverse();
            if (currentDeploymentId) {
                // Filter by deployment
                const all = await q.toArray();
                setShipments(all.filter(s => s.deploymentId === currentDeploymentId));
            } else {
                setShipments(await q.toArray());
            }

            // Load Inventory for Lookup
            const kitItems = await db.kitItems.toArray();
            const invItems = await db.inventoryItems.toArray();

            // Unique parts combining both
            const map = new Map();
            [...kitItems, ...invItems].forEach(i => {
                if (i.partNumber && !map.has(i.partNumber)) {
                    map.set(i.partNumber, { partNumber: i.partNumber, description: i.description });
                }
            });
            setInventoryLookup(Array.from(map.values()));

        } catch (error) {
            console.error("Load Error", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentDeploymentId]);

    // --- Actions ---

    const handleCreate = () => {
        if (!currentDeploymentId) {
            alert('Please select a single active deployment to create a shipment.');
            return;
        }

        const uid = `SHP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        setCurrentShipment({
            uid,
            deploymentId: currentDeploymentId,
            orderDate: new Date().toISOString().split('T')[0],
            shipDate: '',
            hostReceivedDate: '',
            siteReceivedDate: '',
            status: 'Ordered'
        });
        setShipmentItems([]);
        setView('edit');
    };

    const handleEdit = async (shipment) => {
        setCurrentShipment(shipment);
        const items = await db.shipmentItems.where('shipmentId').equals(shipment.id).toArray();
        setShipmentItems(items);
        setView('edit');
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this shipment?')) {
            await db.transaction('rw', db.shipments, db.shipmentItems, async () => {
                await db.shipments.delete(id);
                await db.shipmentItems.where('shipmentId').equals(id).delete();
            });
            loadData();
        }
    };

    const handleSave = async () => {
        if (!currentShipment.uid || !currentShipment.orderDate) {
            alert("UID and Order Date are required");
            return;
        }

        try {
            await db.transaction('rw', db.shipments, db.shipmentItems, async () => {
                let id = currentShipment.id;

                // Determine Status based on dates
                let status = 'Ordered';
                if (currentShipment.shipDate) status = 'Shipped';
                if (currentShipment.hostReceivedDate) status = 'Received (Host)';
                if (currentShipment.siteReceivedDate) status = 'Received (Site)';

                const shipmentData = {
                    ...currentShipment,
                    status,
                    updatedAt: new Date().toISOString()
                };

                if (id) {
                    await db.shipments.update(id, shipmentData);
                } else {
                    shipmentData.createdAt = new Date().toISOString();
                    id = await db.shipments.add(shipmentData);
                }

                // Handle Items (Delete all and re-add for simplicity, or diff? Re-add is safer for small lists)
                // Filter out existing db items for update vs new?
                // Simplest: Delete existing items for this shipment and add current list
                // WARN: If we successfully "Received" items, we might need to preserve link.
                // For now, full replace of items on save is acceptable as long as we keep track of IDs if needed.
                // But wait, if items have IDs, we should keep them.

                // Strategy: 
                // 1. Get existing IDs
                const existing = await db.shipmentItems.where('shipmentId').equals(id).toArray();
                const existingIds = existing.map(e => e.id);
                const currentIds = shipmentItems.map(i => i.id).filter(Boolean);
                const toDelete = existingIds.filter(eid => !currentIds.includes(eid));

                if (toDelete.length > 0) await db.shipmentItems.bulkDelete(toDelete);

                for (const item of shipmentItems) {
                    const itemData = {
                        ...item,
                        shipmentId: id
                    };
                    if (item.id) {
                        await db.shipmentItems.update(item.id, itemData);
                    } else {
                        await db.shipmentItems.add(itemData);
                    }
                }
            });

            setView('list');
            loadData();
        } catch (error) {
            alert('Failed to save: ' + error.message);
        }
    };

    // --- Item Editor ---
    const addItem = () => {
        setShipmentItems([...shipmentItems, {
            partNumber: '',
            description: '',
            quantity: 1,
            serialNumber: '',
            isNewItem: false
        }]);
    };

    const updateItem = (index, field, value) => {
        const newItems = [...shipmentItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-fill description if part selected
        if (field === 'partNumber') {
            const found = inventoryLookup.find(i => i.partNumber === value);
            if (found) {
                newItems[index].description = found.description;
            }
        }
        setShipmentItems(newItems);
    };

    const removeItem = (index) => {
        setShipmentItems(shipmentItems.filter((_, i) => i !== index));
    };

    // --- Render ---

    const renderList = () => {
        // Filter by Search Query first
        const filtered = shipments.filter(s =>
            s.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.status || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Group shipments
        const groups = {};
        if (currentDeploymentId) {
            groups[currentDeploymentId] = filtered;
        } else {
            filtered.forEach(s => {
                const id = s.deploymentId || 0;
                if (!groups[id]) groups[id] = [];
                groups[id].push(s);
            });
        }

        return (
            <div className="space-y-6">
                {/* Header / Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative flex-1 w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Search shipments..."
                            className="input pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleCreate}>
                        <Plus size={18} />
                        Create Shipment
                    </button>
                </div>

                {filtered.length === 0 ? (
                    <div className="card p-8 text-center text-muted">No shipments found.</div>
                ) : Object.entries(groups).map(([depId, groupShipments]) => {
                    const depName = deployments.find(d => d.id == depId)?.name || 'Unknown Deployment';
                    if (groupShipments.length === 0) return null;

                    return (
                        <div key={depId} className="card overflow-hidden mb-6 animate-in fade-in">
                            {!currentDeploymentId && (
                                <div className="card-header bg-bg-secondary/50 border-b border-border py-2 px-4 font-bold text-accent-primary flex items-center gap-2">
                                    <MapPin size={16} /> {depName}
                                </div>
                            )}
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Status</th>
                                            <th>UID</th>
                                            <th>Order Date</th>
                                            <th>Ship Date</th>
                                            <th>Received (Host)</th>
                                            <th>Received (Site)</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupShipments.map(shipment => (
                                            <tr key={shipment.id} className="hover:bg-bg-secondary/50">
                                                <td>
                                                    <span className={`badge ${shipment.status === 'Received (Site)' ? 'badge-success' :
                                                        shipment.status === 'Ordered' ? 'badge-warning' :
                                                            'badge-info'
                                                        }`}>
                                                        {shipment.status}
                                                    </span>
                                                </td>
                                                <td className="font-mono font-bold">{shipment.uid}</td>
                                                <td>{shipment.orderDate}</td>
                                                <td>{shipment.shipDate || '-'}</td>
                                                <td>{shipment.hostReceivedDate || '-'}</td>
                                                <td>{shipment.siteReceivedDate || '-'}</td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            className="btn-icon p-1 text-muted hover:text-primary"
                                                            onClick={() => handleEdit(shipment)}
                                                            title="Edit Shipment"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            className="btn-icon p-1 text-muted hover:text-error"
                                                            onClick={() => handleDelete(shipment.id)}
                                                            title="Delete Shipment"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderEditor = () => (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Truck />
                    {currentShipment.id ? 'Edit Shipment' : 'New Shipment'}
                </h2>
                <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => setView('list')}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Save size={18} />
                        Save Shipment
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Shipment Details</h3>
                </div>
                <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="form-label">Deployment</label>
                        <input
                            className="input bg-bg-secondary text-muted"
                            readOnly
                            value={deployments.find(d => d.id === currentShipment.deploymentId)?.name || 'Unknown'}
                        />
                    </div>
                    <div>
                        <label className="form-label">Shipment UID</label>
                        <input
                            className="input font-mono"
                            value={currentShipment.uid}
                            onChange={e => setCurrentShipment({ ...currentShipment, uid: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">Order Date</label>
                        <input
                            type="date"
                            className="input"
                            value={currentShipment.orderDate}
                            onChange={e => setCurrentShipment({ ...currentShipment, orderDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">Shipment Date</label>
                        <input
                            type="date"
                            className="input"
                            value={currentShipment.shipDate}
                            onChange={e => setCurrentShipment({ ...currentShipment, shipDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">Received by Host Activity</label>
                        <input
                            type="date"
                            className="input"
                            value={currentShipment.hostReceivedDate}
                            onChange={e => setCurrentShipment({ ...currentShipment, hostReceivedDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">Received by Site Lead</label>
                        <input
                            type="date"
                            className="input"
                            value={currentShipment.siteReceivedDate}
                            placeholder="Set via receiving process"
                            readOnly // Usually read-only from here, set via "Receive" action in Inventory? Or editable?
                            // User spec: "once it is 'added to inventory' via button, it should update the shipment date"
                            // So maybe keep it editable for manual correction, but generally automatic.
                            onChange={e => setCurrentShipment({ ...currentShipment, siteReceivedDate: e.target.value })}
                        />
                        <p className="text-xs text-muted mt-1">Populated when items are received in Inventory</p>
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="card">
                <div className="card-header flex justify-between items-center">
                    <h3 className="card-title">Shipment Items</h3>
                    <button className="btn btn-sm btn-secondary" onClick={addItem}>
                        <Plus size={16} />
                        Add Item
                    </button>
                </div>
                <div className="card-body p-0">
                    <div className="table-container border-0 rounded-none">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th className="w-1/4">Part Number</th>
                                    <th className="w-1/3">Description</th>
                                    <th className="w-24">Qty</th>
                                    <th className="w-1/4">Serial No.</th>
                                    <th className="w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {shipmentItems.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <input
                                                list={`parts-${idx}`}
                                                className="input input-sm w-full font-mono"
                                                value={item.partNumber}
                                                onChange={e => updateItem(idx, 'partNumber', e.target.value)}
                                                placeholder="Search or Enter PN"
                                            />
                                            <datalist id={`parts-${idx}`}>
                                                {inventoryLookup.map((i, k) => (
                                                    <option key={k} value={i.partNumber}>{i.description}</option>
                                                ))}
                                            </datalist>
                                        </td>
                                        <td>
                                            <input
                                                className="input input-sm w-full"
                                                value={item.description}
                                                onChange={e => updateItem(idx, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="input input-sm w-full text-center"
                                                value={item.quantity}
                                                onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                className="input input-sm w-full"
                                                value={item.serialNumber || ''}
                                                onChange={e => updateItem(idx, 'serialNumber', e.target.value)}
                                                placeholder="N/A"
                                            />
                                        </td>
                                        <td className="text-right">
                                            <button
                                                className="btn-icon text-error hover:bg-error/10 rounded"
                                                onClick={() => removeItem(idx)}
                                            >
                                                <X size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {shipmentItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-4 text-muted">No items in this shipment.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-500">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Parts Tracking</h1>
                    <p className="page-description">Manage incoming shipments and order requests.</p>
                </div>
            </div>

            {view === 'list' && renderList()}
            {view === 'edit' && renderEditor()}
        </div>
    );
};

export default PartsTracking;
