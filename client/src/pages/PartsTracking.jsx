import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../db/schema';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import {
    Package, Plus, Search, Calendar, Truck, Upload,
    CheckCircle, AlertTriangle, X, Edit, Trash2,
    ChevronDown, ChevronUp, Save, MapPin, Wrench
} from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../components/Modal';

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

    // Import State (Utilization)
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [fileToImport, setFileToImport] = useState(null);
    const [parsedUtil, setParsedUtil] = useState([]);
    const [targetDeploymentId, setTargetDeploymentId] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

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
        // Auto-generate UID: SHIP-YYMMDD-XXXX
        const prefix = `SHIP-${format(new Date(), 'yyMMdd')}`;
        const random = Math.floor(1000 + Math.random() * 9000);
        const newUid = `${prefix}-${random}`;

        setCurrentShipment({ uid: newUid });
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

    // --- Import Handlers (Utilization) ---
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
            e.target.value = null; // Reset input
        }
    };

    const handleFile = (file) => {
        setFileToImport(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Find Header Row (look for "Part No" or "Part Number" or "P/N")
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
                    const row = jsonData[i];
                    if (!row || !Array.isArray(row)) continue;
                    const rowStr = row.map(c => String(c).toLowerCase()).join(' ');

                    const hasPart = rowStr.includes('part') || rowStr.includes('p/n') || rowStr.includes('item');
                    const hasDesc = rowStr.includes('desc') || rowStr.includes('title') || rowStr.includes('name');

                    if (hasPart && hasDesc) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    // Debug scan
                    const scan = jsonData.slice(0, 5).map(r => JSON.stringify(r)).join('\n');
                    alert(`Could not find header row in first 25 rows.\nLooking for columns with 'Part' and 'Description'.\nFirst 5 rows seen:\n${scan}`);
                    return;
                }

                const headers = jsonData[headerRowIdx].map(h => String(h).trim().toLowerCase());
                const rows = jsonData.slice(headerRowIdx + 1);

                // Helper to match column names flexibly
                const getIdx = (patterns) => {
                    if (!Array.isArray(patterns)) patterns = [patterns];
                    // Find first header that matches ANY pattern
                    return headers.findIndex(h => patterns.some(p => h.includes(p)));
                };

                // Column Sigs
                const colDate = getIdx('date');
                const colPart = getIdx(['part no', 'part #', 'p/n', 'part number', 'item']);
                const colDesc = getIdx(['desc', 'title', 'name']);
                const colSerial = getIdx(['s/n', 'serial']);
                const colQty = getIdx(['qty', 'quantity', 'count']);
                const colType = getIdx(['type', 'category']);
                const colRemarks = getIdx(['remark', 'note', 'comment']);

                if (colPart === -1) {
                    alert(`Found header row at ${headerRowIdx + 1}, but could not find 'Part Number' column.\nHeaders found: ${headers.join(', ')}`);
                    return;
                }

                const mapped = rows.map((row, i) => {
                    // "Allow for blanks": Use Part Number if present, otherwise placeholder if row has content
                    let partVal = (row[colPart] !== undefined && row[colPart] !== null) ? String(row[colPart]).trim() : '';

                    if (!partVal) {
                        // Check if row is essentially empty
                        if (!Array.isArray(row)) return null;
                        const hasContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
                        if (!hasContent) return null;

                        // If row has content but no part number, use placeholder
                        partVal = `UNKNOWN_PART_ROW_${i + 1}`;
                    }

                    const descVal = colDesc !== -1 ? (row[colDesc] || '') : '';

                    // Helper for Excel Date
                    const parseDate = (val) => {
                        if (!val) return new Date().toISOString().split('T')[0];
                        if (typeof val === 'number') {
                            const date = new Date((val - 25569) * 86400 * 1000);
                            return date.toISOString().split('T')[0];
                        }
                        return String(val).trim();
                    };

                    return {
                        id: `import-${i}`,
                        date: colDate !== -1 ? parseDate(row[colDate]) : new Date().toISOString().split('T')[0],
                        partNumber: partVal,
                        description: descVal,
                        serialNumber: colSerial !== -1 ? (row[colSerial] || '') : '',
                        quantity: colQty !== -1 ? (Number(row[colQty]) || 1) : 1,
                        type: colType !== -1 ? (row[colType] || 'Unscheduled') : 'Unscheduled',
                        remarks: colRemarks !== -1 ? (row[colRemarks] || '') : ''
                    };
                }).filter(Boolean);


                if (mapped.length === 0) {
                    // Diagnostic Alert
                    const rowSample = rows.length > 0 ? JSON.stringify(rows[0]) : "No rows";
                    const valSample = (rows.length > 0 && colPart > -1) ? rows[0][colPart] : "N/A";
                    alert(`Debug: No records parsed.\nHeaders: ${headers.join(', ')}\nPart Col Index: ${colPart} (${headers[colPart]})\nFirst Row Sample: ${rowSample}\nValue at Part Col: ${valSample}`);
                    return;
                }

                setParsedUtil(mapped);
                setImportModalOpen(true);

                if (currentDeploymentId) {
                    setTargetDeploymentId(currentDeploymentId);
                }

            } catch (error) {
                console.error("Parse Error", error);
                alert(`Error parsing file: ${error.message}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const saveImport = async () => {
        if (!targetDeploymentId) {
            alert('Please select a target deployment.');
            return;
        }

        setImporting(true);
        try {
            const itemsToAdd = parsedUtil.map(u => {
                const { id, ...data } = u;
                return {
                    ...data,
                    deploymentId: parseInt(targetDeploymentId),
                    createdAt: new Date().toISOString()
                };
            });

            await db.partsUtilization.bulkAdd(itemsToAdd);

            setImportModalOpen(false);
            setParsedUtil([]);
            setFileToImport(null);
            loadData();
        } catch (error) {
            console.error(error);
            alert('Failed to save imported utilization records.');
        } finally {
            setImporting(false);
        }
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
                <h3 className="card-title">{currentShipment?.id ? 'Edit Shipment' : 'New Shipment'}</h3>
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

    const [filterDeploymentId, setFilterDeploymentId] = useState('');

    // --- Render Utilization ---
    const renderUtilization = () => {
        // Base list from state (already filtered by global context if set)
        let displayedUtil = activeTab === 'utilization' ? utilization : [];

        // Apply local filter if set (and valid)
        if (filterDeploymentId && !currentDeploymentId) {
            displayedUtil = displayedUtil.filter(u => u.deploymentId === parseInt(filterDeploymentId));
        }

        return (
            <div className="card shadow-lg">
                <div className="card-header flex flex-col md:flex-row justify-between items-center bg-bg-secondary/20 gap-4">
                    <h3 className="card-title flex items-center gap-2">
                        <Wrench size={18} />
                        Utilization History
                    </h3>

                    <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload size={16} /> Import
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".xlsx, .xls"
                        />

                        {!currentDeploymentId ? (
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <span className="text-sm text-muted whitespace-nowrap">Filter by:</span>
                                <select
                                    className="select select-sm select-bordered w-full md:w-48"
                                    value={filterDeploymentId}
                                    onChange={e => setFilterDeploymentId(e.target.value)}
                                >
                                    <option value="">All Deployments</option>
                                    {deployments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <span className="badge badge-ghost">Scoped to {currentDeployment?.name}</span>
                        )}
                    </div>
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
                                {displayedUtil.map(u => {
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
                                {displayedUtil.length === 0 && (
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

            {/* Import Modal */}
            <Modal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                title="Import Utilization"
                size="lg"
            >
                <div className="space-y-4">
                    <div className="bg-bg-tertiary p-3 rounded flex justify-between items-center">
                        <div>
                            <span className="font-bold block">{fileToImport?.name}</span>
                            <span className="text-sm text-muted">{parsedUtil.length} records found</span>
                        </div>
                        <div className="form-group mb-0 w-64">
                            <select
                                className="select select-sm w-full"
                                value={targetDeploymentId}
                                onChange={(e) => setTargetDeploymentId(e.target.value)}
                            >
                                <option value="">Select Target Deployment...</option>
                                {deployments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[60vh]">
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Part No</th>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedUtil.map((r, i) => (
                                    <tr key={i}>
                                        <td>{r.date}</td>
                                        <td className="font-mono text-xs">{r.partNumber}</td>
                                        <td className="text-xs">{r.description}</td>
                                        <td>{r.quantity}</td>
                                        <td>{r.type}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="modal-footer flex start-0">
                        <div className="flex-1"></div>
                        <button className="btn btn-ghost" onClick={() => setImportModalOpen(false)}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={saveImport}
                            disabled={importing || !targetDeploymentId}
                        >
                            {importing ? 'Importing...' : 'Confirm Import'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PartsTracking;
