import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/schema';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import {
    Package, Plus, Search, Calendar, Truck,
    CheckCircle, AlertTriangle, X, Edit, Trash2,
    ChevronDown, ChevronUp, Save, MapPin, Wrench
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
    const [utilization, setUtilization] = useState([]); // New state for utilization
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState('list'); // 'list', 'edit', 'create'
    const [activeTab, setActiveTab] = useState('shipments'); // 'shipments' or 'utilization'
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
            // Load Shipments
            let q = db.shipments.orderBy('orderDate').reverse();
            // Load Utilization
            let u = db.partsUtilization.orderBy('date').reverse();

            if (currentDeploymentId) {
                // Filter by deployment
                const allShips = await q.toArray();
                setShipments(allShips.filter(s => s.deploymentId === currentDeploymentId));

                const allUtil = await u.toArray();
                setUtilization(allUtil.filter(rec => rec.deploymentId === currentDeploymentId));
            } else {
                setShipments(await q.toArray());
                setUtilization(await u.toArray());
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

    // --- Actions ---
    const handleCreate = () => {
        setCurrentShipment(null);
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
        if (confirm('Delete this shipment?')) {
            await db.transaction('rw', db.shipments, db.shipmentItems, async () => {
                await db.shipments.delete(id);
                await db.shipmentItems.where('shipmentId').equals(id).delete();
            });
            loadData();
        }
    };

    const handleBack = () => {
        setView('list');
        setCurrentShipment(null);
        setShipmentItems([]);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            await db.transaction('rw', db.shipments, db.shipmentItems, async () => {
                let sId = currentShipment?.id;

                const shipmentData = {
                    uid: data.uid,
                    deploymentId: parseInt(data.deploymentId) || (currentDeploymentId || 0),
                    orderDate: data.orderDate,
                    status: data.status, // Ordered, Shipped, Received (Host), Received (Site)
                    updatedAt: new Date().toISOString()
                };

                if (sId) {
                    await db.shipments.update(sId, shipmentData);
                } else {
                    shipmentData.createdAt = new Date().toISOString();
                    sId = await db.shipments.add(shipmentData);
                }

                // Handle Items
                // Strategy: Delete all existing for this shipment and re-add (simpler for now than diffing)
                // Note: If preserving 'receivedDate' per item is needed, we'd need smarter diffing.
                // For now, assuming edit is mostly for initial setup or minor corrections.
                await db.shipmentItems.where('shipmentId').equals(sId).delete();

                for (const item of shipmentItems) {
                    await db.shipmentItems.add({
                        shipmentId: sId,
                        partNumber: item.partNumber,
                        description: item.description,
                        quantity: parseInt(item.quantity) || 1,
                        serialNumber: item.serialNumber || '',
                        isNewItem: true // Default
                    });
                }
            });
            loadData();
            handleBack();
        } catch (err) {
            console.error(err);
            alert("Failed to save shipment");
        }
    };

    // Item Form Actions
    const addItem = () => {
        setShipmentItems([...shipmentItems, { partNumber: '', description: '', quantity: 1 }]);
    };

    const updateItem = (index, field, val) => {
        const newItems = [...shipmentItems];
        newItems[index] = { ...newItems[index], [field]: val };

        // Auto-fill description from lookup if part number changes
        if (field === 'partNumber') {
            const match = inventoryLookup.find(i => i.partNumber === val);
            if (match) newItems[index].description = match.description;
        }

        setShipmentItems(newItems);
    };

    const removeItem = (index) => {
        setShipmentItems(shipmentItems.filter((_, i) => i !== index));
    };

    // --- Renderers ---

    const renderList = () => (
        <div className="card">
            <div className="card-header flex justify-between items-center">
                <h3 className="card-title">Shipments</h3>
                <button className="btn btn-primary btn-sm gap-2" onClick={handleCreate}>
                    <Plus size={16} /> New Shipment
                </button>
            </div>
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>UID/Tracking</th>
                            <th>Order Date</th>
                            <th>Status</th>
                            <th>Deployment</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shipments.map(s => (
                            <tr key={s.id}>
                                <td className="font-mono font-bold">{s.uid}</td>
                                <td>{s.orderDate}</td>
                                <td>
                                    <span className={`badge ${s.status.includes('Received') ? 'badge-success' :
                                            s.status === 'Shipped' ? 'badge-info' : 'badge-warning'
                                        }`}>
                                        {s.status}
                                    </span>
                                </td>
                                <td className="text-sm text-muted">
                                    {deployments.find(d => d.id === s.deploymentId)?.name || '-'}
                                </td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(s)}>
                                            <Edit size={16} />
                                        </button>
                                        <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDelete(s.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {shipments.length === 0 && (
                            <tr>
                                <td colSpan="5" className="text-center py-8 text-muted">No shipments found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderEditor = () => (
        <div className="card">
            <div className="card-header flex justify-between items-center">
                <h3 className="card-title">{currentShipment ? 'Edit Shipment' : 'New Shipment'}</h3>
                <button className="btn btn-ghost btn-sm" onClick={handleBack}>Cancel</button>
            </div>
            <div className="card-body">
                <form onSubmit={handleSave}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="form-control">
                            <label className="label">UID / Tracking #</label>
                            <input name="uid" defaultValue={currentShipment?.uid} className="input" required placeholder="e.g. SHIP-001" />
                        </div>
                        <div className="form-control">
                            <label className="label">Order Date</label>
                            <input type="date" name="orderDate" defaultValue={currentShipment?.orderDate || new Date().toISOString().split('T')[0]} className="input" required />
                        </div>
                        <div className="form-control">
                            <label className="label">Status</label>
                            <select name="status" defaultValue={currentShipment?.status || 'Ordered'} className="select">
                                <option>Ordered</option>
                                <option>Shipped</option>
                                <option>Received (Host)</option>
                                <option>Received (Site)</option>
                            </select>
                        </div>
                        <div className="form-control">
                            <label className="label">Deployment</label>
                            <select name="deploymentId" defaultValue={currentShipment?.deploymentId || currentDeploymentId || ''} className="select" required>
                                <option value="">Select Deployment...</option>
                                {deployments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="divider">Items</div>

                    <div className="space-y-2 mb-6">
                        {shipmentItems.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-end bg-bg-tertiary/30 p-2 rounded">
                                <div className="form-control flex-1">
                                    <label className="text-xs mb-1">Part Number</label>
                                    <div className="relative">
                                        <input
                                            className="input input-sm w-full font-mono"
                                            value={item.partNumber}
                                            onChange={e => updateItem(idx, 'partNumber', e.target.value)}
                                            list={`part-list-${idx}`}
                                            required
                                        />
                                        <datalist id={`part-list-${idx}`}>
                                            {inventoryLookup.map((i, k) => <option key={k} value={i.partNumber} />)}
                                        </datalist>
                                    </div>
                                </div>
                                <div className="form-control flex-[2]">
                                    <label className="text-xs mb-1">Description</label>
                                    <input
                                        className="input input-sm w-full"
                                        value={item.description}
                                        onChange={e => updateItem(idx, 'description', e.target.value)}
                                    />
                                </div>
                                <div className="form-control w-24">
                                    <label className="text-xs mb-1">Qty</label>
                                    <input
                                        type="number"
                                        className="input input-sm w-full text-center"
                                        value={item.quantity}
                                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                        min="1"
                                    />
                                </div>
                                <button type="button" className="btn btn-sm btn-ghost text-error" onClick={() => removeItem(idx)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button type="button" className="btn btn-sm btn-ghost dashed-border w-full" onClick={addItem}>
                            <Plus size={14} /> Add Item
                        </button>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button type="button" className="btn btn-secondary" onClick={handleBack}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Shipment</button>
                    </div>
                </form>
            </div>
        </div>
    );

    // --- Render Utilization ---
    const renderUtilization = () => {
        // Filter: If active deployment, show only that. If global, show all.
        const filteredUtil = activeTab === 'utilization' ? utilization.filter(u => {
            if (currentDeploymentId) return u.deploymentId === currentDeploymentId;
            return true;
        }) : [];

        return (
            <div className="card shadow-lg">
                <div className="card-header flex justify-between items-center bg-bg-secondary/20">
                    <h3 className="card-title flex items-center gap-2">
                        <Wrench size={18} />
                        Utilization History
                    </h3>
                    {!currentDeploymentId && <span className="badge badge-ghost">All Deployments</span>}
                </div>
                <div className="card-body p-0">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    {!currentDeploymentId && <th>Deployment</th>}
                                    <th>Part Number</th>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>Type</th>
                                    <th>Logged At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUtil.map(u => {
                                    const depName = deployments.find(d => d.id === u.deploymentId)?.name || 'Unknown';
                                    return (
                                        <tr key={u.id} className="hover:bg-bg-tertiary/50">
                                            <td className="font-mono">{u.date}</td>
                                            {!currentDeploymentId && <td className="text-muted text-sm">{depName}</td>}
                                            <td className="font-bold">{u.partNumber}</td>
                                            <td className="text-muted">{u.description || '-'}</td>
                                            <td className="font-mono">{u.quantity}</td>
                                            <td>
                                                <span className={`badge ${u.type === 'Unscheduled' ? 'badge-warning' : 'badge-info'}`}>
                                                    {u.type}
                                                </span>
                                            </td>
                                            <td className="text-xs text-muted">{new Date(u.createdAt).toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                                {filteredUtil.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-muted">No utilization records found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-24">
            <div className="page-header mb-6">
                <div>
                    <h1 className="page-title">Parts Management</h1>
                    <p className="page-description">Manage incoming shipments and track parts utilization.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs tabs-boxed mb-6 bg-transparent p-0 gap-2">
                <button
                    className={`tab tab-lg ${activeTab === 'shipments' ? 'tab-active btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('shipments')}
                >
                    <Truck size={16} className="mr-2" />
                    Shipments & Orders
                </button>
                <button
                    className={`tab tab-lg ${activeTab === 'utilization' ? 'tab-active btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('utilization')}
                >
                    <Wrench size={16} className="mr-2" />
                    Utilization History
                </button>
                {/* Editor is ephemeral, overlays list if active */}
            </div>

            {activeTab === 'shipments' && (
                <>
                    {view === 'list' && renderList()}
                    {view === 'edit' && renderEditor()}
                </>
            )}

            {activeTab === 'utilization' && renderUtilization()}
        </div>
    );
};

export default PartsTracking;
