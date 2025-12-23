import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../db/schema';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';

import * as XLSX from 'xlsx';
import { format, differenceInDays } from 'date-fns';
import {
    Save, Plus, Trash2, AlertTriangle, Package, Search,
    CheckCircle2, Download, Pencil, Check, Lock, Unlock,
    Truck, Archive, X, LayoutList, Clock, Wrench, Calendar
} from 'lucide-react';

const Inventory = () => {
    const { canEdit, user } = useAuth();
    const { selectedDeploymentIds, deployments } = useDeployment();

    // State
    const [kitItems, setKitItems] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [isLocked, setIsLocked] = useState(true);

    // Shipping Queue
    const [incomingShipments, setIncomingShipments] = useState([]);
    const [receivingShipment, setReceivingShipment] = useState(null); // For modal
    const [receiveDate, setReceiveDate] = useState('');
    // Temp state for receiving quantity edits { itemIndex: qty }
    const [receiveQtys, setReceiveQtys] = useState({});

    // Reset receive form when modal opens
    useEffect(() => {
        if (receivingShipment) {
            setReceiveDate(new Date().toISOString().split('T')[0]);
            setReceiveQtys({});
        }
    }, [receivingShipment]);

    // Local edits buffer
    const [kitEdits, setKitEdits] = useState({}); // { partNumber: newTotalActual }
    const [invEdits, setInvEdits] = useState({}); // { id: { ...updates } }
    const [newItems, setNewItems] = useState([]); // [{ tempId, partNumber, description, quantity }]

    // Parts Utilization State
    const [utilizationRows, setUtilizationRows] = useState([
        { id: Date.now(), partNumber: '', quantity: 1, type: 'Unscheduled' }
    ]);
    const [utilSuccess, setUtilSuccess] = useState(false);

    const selectedDeploymentId = (selectedDeploymentIds && selectedDeploymentIds.length === 1)
        ? selectedDeploymentIds[0]
        : null;

    const currentDeployment = deployments.find(d => d.id === selectedDeploymentId);

    // Inventory Freshness
    const lastUpdateDate = currentDeployment?.lastInventoryUpdate;
    const daysSinceLastUpdate = lastUpdateDate ? differenceInDays(new Date(), new Date(lastUpdateDate)) : null;
    const isInventoryOutdated = !lastUpdateDate || (daysSinceLastUpdate > 7);

    useEffect(() => {
        if (selectedDeploymentId) {
            loadData();
        } else {
            setKitItems([]);
            setInventoryItems([]);
        }
    }, [selectedDeploymentId]);

    // Load Incoming Shipments
    useEffect(() => {
        const loadQueue = async () => {
            if (!selectedDeploymentId) return;
            // Get shipments for this deployment that are NOT fully received by site
            // Use filter() with loose equality (==) to handle potential String vs Number mismatches for deploymentId
            const ships = await db.shipments
                .filter(s => s.deploymentId == selectedDeploymentId && s.status !== 'Received (Site)')
                .toArray();

            // Enrich with item count
            const enriched = await Promise.all(ships.map(async s => {
                const count = await db.shipmentItems.where('shipmentId').equals(s.id).count();
                return { ...s, itemCount: count };
            }));

            setIncomingShipments(enriched);
        };
        loadQueue();
    }, [selectedDeploymentId, hasChanges]); // Reload when saved/changed

    const loadData = async () => {
        if (!selectedDeploymentId) return;
        setIsLoading(true);
        try {
            // 1. Get Kits for Deployment
            const kits = await db.kits.where('deploymentId').equals(selectedDeploymentId).toArray();
            const kitIds = kits.map(k => k.id);

            // 2. Get Items for those Kits
            const kItems = await db.kitItems.where('kitId').anyOf(kitIds).toArray();
            setKitItems(kItems);

            // 3. Get Inventory Items (Added Items)
            const iItems = await db.inventoryItems.where('deploymentId').equals(selectedDeploymentId).toArray();
            setInventoryItems(iItems);

            // Reset edits
            setKitEdits({});
            setInvEdits({});
            setNewItems([]);
            setHasChanges(false);
        } catch (error) {
            console.error("Error loading inventory:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Consolidate Kit Items by Part Number and Description
    const ConsolidatedKits = useMemo(() => {
        const map = new Map();

        kitItems.forEach(item => {
            const p = item.partNumber ? String(item.partNumber).trim() : 'N/A';
            const d = item.description ? String(item.description).trim() : 'N/A';
            const compositeKey = `${p}__|__${d}`; // Unique string key

            if (!map.has(compositeKey)) {
                map.set(compositeKey, {
                    key: compositeKey,
                    partNumber: item.partNumber || '',
                    description: item.description || '',
                    expected: 0,
                    actual: 0,
                    ids: [] // Track DB IDs contributing to this row
                });
            }
            const entry = map.get(compositeKey);
            const qty = parseInt(item.quantity) || 0;
            const act = parseInt(item.actualQuantity) || 0;

            entry.expected += qty;
            entry.actual += act;
            entry.ids.push({ id: item.id, quantity: qty });
        });

        let results = Array.from(map.values());

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            results = results.filter(r =>
                String(r.partNumber).toLowerCase().includes(lower) ||
                String(r.description).toLowerCase().includes(lower)
            );
        }

        return results.sort((a, b) => String(a.partNumber).localeCompare(String(b.partNumber)));
    }, [kitItems, searchTerm]);

    // Added Items List with filtering
    const VisibleInventoryItems = useMemo(() => {
        let results = [...inventoryItems];
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            results = results.filter(r =>
                String(r.partNumber || '').toLowerCase().includes(lower) ||
                String(r.description || '').toLowerCase().includes(lower)
            );
        }
        return results;
    }, [inventoryItems, searchTerm]);

    // Handlers
    const handleKitActualChange = (key, value) => {
        // Store raw value to prevent input jumping, sanitize on use/save
        setKitEdits(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleInvItemChange = (id, field, value) => {
        setInvEdits(prev => ({
            ...prev,
            [id]: { ...(prev[id] || {}), [field]: value }
        }));
        setHasChanges(true);
    };

    const handleNewItemChange = (tempId, field, value) => {
        setNewItems(prev => prev.map(item =>
            item.tempId === tempId ? { ...item, [field]: value } : item
        ));
        setHasChanges(true);
    };

    const addNewItem = () => {
        setNewItems(prev => [
            ...prev,
            { tempId: Date.now(), partNumber: '', description: '', quantity: 0 }
        ]);
        setHasChanges(true);
    };

    const removeNewItem = (tempId) => {
        setNewItems(prev => prev.filter(i => i.tempId !== tempId));
        // Check if this was the last change? simplistic: keep True
    };

    const deleteInventoryItem = async (id) => {
        if (confirm('Remove this item?')) {
            await db.inventoryItems.delete(id);
            loadData();
        }
    };

    const handleTableKeyDown = (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('.inventory-qty-input:not([disabled])'));
            const index = inputs.indexOf(e.target);

            if (index !== -1) {
                let nextIndex = index;
                if (e.key === 'ArrowUp') nextIndex = Math.max(0, index - 1);
                if (e.key === 'ArrowDown' || e.key === 'Enter') nextIndex = Math.min(inputs.length - 1, index + 1);

                if (nextIndex !== index) {
                    inputs[nextIndex].focus();
                    inputs[nextIndex].select();
                }
            }
        }
    };

    const handleExport = () => {
        try {
            const data = [];

            // 1. Kit Items (Consolidated)
            ConsolidatedKits.forEach(row => {
                const rawValue = kitEdits[row.key] !== undefined ? kitEdits[row.key] : row.actual;
                const numActual = rawValue === '' ? 0 : (parseInt(rawValue) || 0);

                data.push({
                    Type: 'Kit Item',
                    'Part Number': row.partNumber || '',
                    Description: row.description || '',
                    Expected: row.expected,
                    Actual: numActual,
                    Status: numActual < row.expected ? `Missing ${row.expected - numActual}` : 'OK'
                });
            });

            // 2. Additional Items (Visible/Filtered)
            VisibleInventoryItems.forEach(item => {
                const edited = invEdits[item.id] || {};
                const rawQty = edited.quantity !== undefined ? edited.quantity : item.quantity;
                const numQty = parseInt(rawQty) || 0;
                const p = edited.partNumber !== undefined ? edited.partNumber : (item.partNumber || '');
                const d = edited.description !== undefined ? edited.description : (item.description || '');

                data.push({
                    Type: 'Additional',
                    'Part Number': p,
                    Description: d,
                    Expected: 0,
                    Actual: numQty,
                    Status: 'Extra'
                });
            });

            // 3. Draft Items
            newItems.forEach(item => {
                data.push({
                    Type: 'Additional (Draft)',
                    'Part Number': item.partNumber || '',
                    Description: item.description || '',
                    Expected: 0,
                    Actual: parseInt(item.quantity) || 0,
                    Status: 'Draft'
                });
            });

            if (data.length === 0) {
                alert("No inventory data available to export.");
                return;
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Master Inventory");

            // Generate Filename
            let depName = 'Master';
            if (currentDeployment && currentDeployment.name) {
                depName = currentDeployment.name.replace(/[^a-z0-9]/gi, '_');
            }

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `Inventory_${depName}_${dateStr}.xlsx`;

            XLSX.writeFile(wb, fileName);
            // alert("Export started check downloads."); // Optional, usually browser handles it.

        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export: " + error.message);
        }
    };

    const handleSaveAll = async () => {
        // Removed confirm dialog to fix user interaction issues
        setIsLoading(true);
        try {
            // 1. Process Kit Updates (Distribute totals)
            const kitPromises = ConsolidatedKits.map(async (row) => {
                const newTotalVal = kitEdits[row.key];

                // If undefined, no change for this row
                if (newTotalVal === undefined) return null;

                const newTotal = newTotalVal === '' ? 0 : (parseInt(newTotalVal) || 0);
                let remaining = newTotal;

                // Sort items by ID to be stable
                const items = [...row.ids].sort((a, b) => a.id - b.id);

                const updates = items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    let target = 0;

                    if (isLast) {
                        target = remaining;
                    } else {
                        target = Math.min(item.quantity, remaining);
                    }

                    remaining = Math.max(0, remaining - target);
                    return db.kitItems.update(item.id, {
                        actualQuantity: target,
                        lastUpdatedBy: user?.name || 'Unknown'
                    });
                });

                return Promise.all(updates);
            });

            // 2. Process Inventory Item Updates
            const invPromises = Object.entries(invEdits).map(([id, updates]) =>
                db.inventoryItems.update(parseInt(id), {
                    ...updates,
                    lastUpdatedBy: user?.name || 'Unknown'
                })
            );

            // Update Deployment Last Inventory Update Timestamp
            const deploymentUpdate = db.deployments.update(selectedDeploymentId, {
                lastInventoryUpdate: new Date().toISOString()
            });

            // 3. Process New Items
            const newPromises = newItems.map(item => {
                const { tempId, ...data } = item;
                return db.inventoryItems.add({
                    ...data,
                    deploymentId: selectedDeploymentId,
                    createdAt: new Date().toISOString(),
                    quantity: parseInt(item.quantity) || 0,
                    lastUpdatedBy: user?.name || 'Unknown'
                });
            });

            await Promise.all([...kitPromises, ...invPromises, ...newPromises, deploymentUpdate]);
            await loadData();
            // Optional: alert('Saved');
        } catch (error) {
            console.error("Save failed:", error);
            alert("Failed to save inventory.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReceiveSubmit = async () => {
        if (!receivingShipment) return;

        try {
            // Include db.kits and db.kitItems in the transaction
            await db.transaction('rw', db.shipments, db.shipmentItems, db.inventoryItems, db.kits, db.kitItems, async () => {
                // 1. Mark Shipment Received
                await db.shipments.update(receivingShipment.id, {
                    status: 'Received (Site)',
                    siteReceivedDate: receiveDate,
                    lastUpdatedBy: user?.name || 'Unknown'
                });

                // Prepare Reference Data: Kits and KitItems for this deployment
                const kits = await db.kits.where('deploymentId').equals(selectedDeploymentId).toArray();
                const kitIds = kits.map(k => k.id);
                const kitItemsAll = await db.kitItems.where('kitId').anyOf(kitIds).toArray();

                // 2. Process Items
                const shipItems = await db.shipmentItems.where('shipmentId').equals(receivingShipment.id).toArray();

                for (const sItem of shipItems) {
                    const val = receiveQtys[sItem.id];
                    let qtyReceived = val !== undefined ? parseInt(val) : sItem.quantity;

                    if (qtyReceived <= 0) continue;

                    // A. Check for Kit Items first
                    // Find all kit items with matching Part Number
                    const matchingKitItems = kitItemsAll.filter(ki =>
                        String(ki.partNumber || '').trim().toLowerCase() === String(sItem.partNumber || '').trim().toLowerCase()
                    );

                    let processed = false;

                    if (matchingKitItems.length > 0) {
                        // Priority: Update the first matching kit item (or distribute? usually one match)
                        // User request: "simply update the quantity" (implies adding to it)
                        const targetKitItem = matchingKitItems[0];
                        const currentActual = parseInt(targetKitItem.actualQuantity) || 0;
                        const newActual = currentActual + qtyReceived;

                        await db.kitItems.update(targetKitItem.id, {
                            actualQuantity: newActual,
                            lastUpdatedBy: user?.name || 'Unknown'
                        });
                        processed = true;
                    }

                    // B. If not in Kit, check Additional Items (InventoryItems)
                    if (!processed) {
                        // Check if we already have this item in Additional Items to consolidate
                        // Ensure deploymentId is int for query
                        const depId = parseInt(selectedDeploymentId);

                        // Use filter on the collection/table might be safer if constraints vary, 
                        // but compound index [deploymentId+partNumber] isn't guaranteed unique/present.
                        // Let's fetch all for deployment and find in memory to be safe on string matching
                        const depItems = await db.inventoryItems
                            .where('deploymentId').equals(depId)
                            .toArray();

                        const existingInv = depItems.find(i =>
                            String(i.partNumber || '').trim().toLowerCase() === String(sItem.partNumber || '').trim().toLowerCase()
                        );

                        if (existingInv) {
                            // Consolidate
                            await db.inventoryItems.update(existingInv.id, {
                                quantity: (parseInt(existingInv.quantity) || 0) + qtyReceived,
                                updatedAt: new Date().toISOString(),
                                lastUpdatedBy: user?.name || 'Unknown'
                            });
                        } else {
                            // Create New
                            await db.inventoryItems.add({
                                deploymentId: depId,
                                partNumber: sItem.partNumber,
                                description: sItem.description,
                                quantity: qtyReceived,
                                category: 'Spare Parts',
                                location: 'Received',
                                notes: `Received from Shipment ${receivingShipment.uid}`,
                                createdAt: new Date().toISOString(),
                                lastUpdatedBy: user?.name || 'Unknown'
                            });
                        }
                    }

                    await db.shipmentItems.update(sItem.id, { receivedDate: new Date().toISOString() });
                }
            });

            setReceivingShipment(null);
            setReceiveQtys({});
            setHasChanges(true); // Trigger queue reload
            await loadData(); // Refresh table data
        } catch (e) {
            console.error(e);
            alert('Receive failed: ' + e.message);
        }
    };

    // Parts Utilization Handlers
    const handleAddUtilRow = () => {
        setUtilizationRows(prev => [
            ...prev,
            { id: Date.now(), partNumber: '', quantity: 1, type: 'Unscheduled' }
        ]);
    };

    const handleRemoveUtilRow = (id) => {
        setUtilizationRows(prev => prev.filter(r => r.id !== id));
    };

    const handleUtilChange = (id, field, value) => {
        setUtilizationRows(prev => prev.map(r =>
            r.id === id ? { ...r, [field]: value } : r
        ));
    };

    const handleSubmitUtilization = async () => {
        if (!selectedDeploymentId) return;

        // Filter empty rows
        const validRows = utilizationRows.filter(r => r.partNumber.trim() !== '');
        if (validRows.length === 0) {
            alert("Please enter at least one part number.");
            return;
        }

        try {
            await db.transaction('rw', ['partsUtilization', 'inventoryItems', 'kitItems', 'kits'], async () => {
                const timestamp = new Date().toISOString();

                for (const row of validRows) {
                    const qty = parseInt(row.quantity) || 0;
                    if (qty <= 0) continue;

                    // Parse Part Number / Description
                    let pNum = row.partNumber;
                    let desc = '';
                    if (row.partNumber.includes(' | ')) {
                        const parts = row.partNumber.split(' | ');
                        pNum = parts[0].trim();
                        desc = parts[1].trim();
                    }

                    // 1. Record Utilization
                    await db.table('partsUtilization').add({
                        deploymentId: selectedDeploymentId,
                        partNumber: pNum,
                        description: desc,
                        quantity: qty,
                        type: row.type,
                        date: timestamp.split('T')[0],
                        createdAt: timestamp
                    });

                    // 2. Decrement Inventory (Basic Strategy: Check Inventory Items first, then Kit Items)
                    // Note: This is an implicit "consumption"

                    // Check Additional Inventory first
                    const invItem = await db.table('inventoryItems')
                        .where('deploymentId').equals(selectedDeploymentId)
                        .and(i => {
                            const matchPN = String(i.partNumber).toLowerCase() === String(pNum).toLowerCase();
                            const matchDesc = desc ? String(i.description || '').toLowerCase() === String(desc).toLowerCase() : true;
                            return matchPN && matchDesc;
                        })
                        .first();

                    if (invItem) {
                        const newQty = Math.max(0, (parseInt(invItem.quantity) || 0) - qty);
                        await db.table('inventoryItems').update(invItem.id, { quantity: newQty });
                        continue; // Consumed
                    }

                    // Check Kits (more complex, might have multiple, just take from first available)
                    const kits = await db.table('kits').where('deploymentId').equals(selectedDeploymentId).toArray();
                    const kitIds = kits.map(k => k.id);
                    const kItem = await db.table('kitItems')
                        .where('kitId').anyOf(kitIds)
                        .and(i => {
                            const matchPN = String(i.partNumber).toLowerCase() === String(pNum).toLowerCase();
                            const matchDesc = desc ? String(i.description || '').toLowerCase() === String(desc).toLowerCase() : true;
                            return matchPN && matchDesc;
                        })
                        .first();

                    if (kItem) {
                        const newActual = Math.max(0, (parseInt(kItem.actualQuantity) || 0) - qty);
                        await db.table('kitItems').update(kItem.id, { actualQuantity: newActual });
                    }
                }
            });

            setUtilSuccess(true);
            setTimeout(() => setUtilSuccess(false), 3000);
            setUtilizationRows([{ id: Date.now(), partNumber: '', quantity: 1, type: 'Unscheduled' }]);
            loadData(); // Refresh inventory counts
        } catch (e) {
            console.error("Utilization error:", e);
            alert("Failed to submit utilization: " + e.message);
        }
    };

    // Render Helpers
    const getRowColor = (actual, expected) => {
        // Safe cast
        const numActual = actual === '' ? 0 : (parseInt(actual) || 0);
        if (numActual < expected * 0.5) return 'bg-red-500/10 border-l-2 border-l-red-500';
        if (numActual < expected) return 'bg-yellow-500/10 border-l-2 border-l-yellow-500';
        return 'hover:bg-bg-tertiary border-l-2 border-l-transparent';
    };

    if (!selectedDeploymentId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                <AlertTriangle size={48} className="text-muted mb-4" />
                <h2 className="text-xl font-bold mb-2">Select a Deployment</h2>
                <p className="text-muted max-w-md">
                    Please select a single deployment from the sidebar to view its Master Inventory.
                    {selectedDeploymentIds && selectedDeploymentIds.length > 1 && (
                        <span className="block mt-2 text-warning">
                            You currently have multiple deployments selected.
                        </span>
                    )}
                </p>
            </div>
        );
    }

    return (
        <div className="pb-24 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                <div>
                    <h1 className="page-title flex items-center gap-2">
                        <Package className="text-primary" />
                        Master Inventory
                    </h1>
                    <p className="page-description">
                        Consolidated inventory for <span className="text-accent-primary font-bold">{currentDeployment?.name}</span>
                    </p>
                    <p className={`text-xs font-mono mt-1 ${isInventoryOutdated ? 'text-error font-bold flex items-center gap-1' : 'text-success'}`}>
                        {isInventoryOutdated && <AlertTriangle size={12} />}
                        Last Validated: {lastUpdateDate ? format(new Date(lastUpdateDate), 'MMM d, yyyy') : 'Never'}
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">

                    {/* Lock Toggle */}
                    {canEdit && (
                        <button
                            className={`btn btn-sm gap-2 ${isLocked ? 'btn-secondary' : 'btn-warning'}`}
                            onClick={() => setIsLocked(!isLocked)}
                            title={isLocked ? "Unlock Inventory to Edit" : "Lock Inventory"}
                        >
                            {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                            {isLocked ? 'Locked' : 'Unlocked'}
                        </button>
                    )}
                    {/* Mark Verified / Save All Button */}
                    <button
                        className={`btn btn-sm gap-2 ${hasChanges ? "btn-primary animate-pulse" : utilSuccess ? "btn-success" : "btn-secondary"}`}
                        onClick={handleSaveAll}
                        title="Save Changes and Mark Inventory Verified"
                    >
                        <Save size={16} />
                        {hasChanges ? "Save Changes" : "Mark Verified"}
                    </button>
                    <button className="btn btn-secondary btn-sm gap-2" onClick={handleExport}>
                        <Download size={16} />
                        Export
                    </button>
                    {/* TEST BUTTON REMOVED */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input
                            type="text"
                            className="input input-sm pl-9 w-full"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Outdated Inventory Warning */}
            {isInventoryOutdated && (
                <div className="alert alert-warning shadow-lg mb-6 animate-pulse">
                    <Clock />
                    <div>
                        <h3 className="font-bold">Inventory Check Required</h3>
                        <div className="text-xs">
                            {lastUpdateDate
                                ? `Last updated ${daysSinceLastUpdate} days ago. Please verify and save inventory.`
                                : "Inventory has never been updated. Please verify and save."}
                        </div>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={handleSaveAll}>Mark Verified</button>
                </div>
            )}

            {/* Incoming Shipment Queue */}
            {incomingShipments.length > 0 && (
                <div className="card mb-8 border border-info/30" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                    <div className="card-header py-3 flex justify-between items-center" style={{ borderBottomColor: 'rgba(59, 130, 246, 0.1)' }}>
                        <h3 className="card-title text-lg flex items-center gap-2 text-info">
                            <Truck size={18} />
                            Incoming Shipments
                            <span className="badge badge-info ml-2">{incomingShipments.length}</span>
                        </h3>
                    </div>
                    <div className="card-body p-0">
                        {incomingShipments.map(s => (
                            <div key={s.id} className="flex flex-col md:flex-row items-center justify-between p-4 border-b last:border-0 hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(59, 130, 246, 0.1)' }}>
                                <div className="flex items-center gap-6 mb-4 md:mb-0">
                                    <div className="font-mono font-bold text-lg">{s.uid}</div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted uppercase tracking-wider">Ordered</span>
                                        <span className="font-medium">{format(new Date(s.orderDate), 'MMM d, yyyy')}</span>
                                    </div>
                                    <div className="badge bg-bg-primary border border-info/30">{s.itemCount} Items</div>
                                </div>
                                <button
                                    className="btn btn-primary gap-2 shadow-md"
                                    onClick={() => setReceivingShipment(s)}
                                >
                                    <Package size={16} />
                                    Receive Shipment
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Parts Utilization Tracker */}
            <div className="card mb-8 border border-primary/20 bg-bg-secondary/30">
                <div className="card-header py-3 flex justify-between items-center border-b border-primary/10">
                    <h3 className="card-title text-lg flex items-center gap-2 text-primary">
                        <Wrench size={18} />
                        Parts Utilization Tracker
                    </h3>
                    {utilSuccess && (
                        <span className="text-success text-sm flex items-center gap-1 animate-in fade-in slide-in-from-right">
                            <CheckCircle2 size={14} /> Recorded
                        </span>
                    )}
                </div>
                <div className="card-body p-4">
                    <div className="flex flex-col gap-2">
                        {utilizationRows.map((row, index) => (
                            <div key={row.id} className="flex flex-col md:flex-row gap-2 items-end">
                                <div className="form-control flex-1">
                                    {index === 0 && <label className="label-text text-xs mb-1 block">Part Number</label>}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="input input-sm w-full font-mono"
                                            placeholder="Part Number | Description"
                                            value={row.partNumber}
                                            onChange={(e) => handleUtilChange(row.id, 'partNumber', e.target.value)}
                                            list={`util-part-list-${row.id}`}
                                        />
                                        <datalist id={`util-part-list-${row.id}`}>
                                            {/* Combine Kits and Inventory for options */}
                                            {Array.from(new Set([
                                                ...ConsolidatedKits.map(k => `${k.partNumber} | ${k.description}`),
                                                ...inventoryItems.map(i => `${i.partNumber} | ${i.description}`)
                                            ])).filter(Boolean).map((val, i) => (
                                                <option key={i} value={val} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                                <div className="form-group w-32">
                                    {index === 0 && <label className="label-text text-xs mb-1 block">Quantity</label>}
                                    <input
                                        type="number"
                                        min="1"
                                        className="input input-sm w-full"
                                        value={row.quantity}
                                        onChange={(e) => handleUtilChange(row.id, 'quantity', e.target.value)}
                                    />
                                </div>
                                <div className="form-group w-40">
                                    {index === 0 && <label className="label-text text-xs mb-1 block">Type</label>}
                                    <select
                                        className="select select-sm w-full"
                                        value={row.type}
                                        onChange={(e) => handleUtilChange(row.id, 'type', e.target.value)}
                                    >
                                        <option value="Unscheduled">Unscheduled</option>
                                        <option value="Scheduled">Scheduled</option>
                                    </select>
                                </div>
                                <div className="pb-1">
                                    <button
                                        className="btn btn-sm btn-ghost text-muted hover:text-error"
                                        onClick={() => handleRemoveUtilRow(row.id)}
                                        disabled={utilizationRows.length === 1}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-4">
                        <button className="btn btn-sm btn-ghost gap-2" onClick={handleAddUtilRow}>
                            <Plus size={16} /> Add Part
                        </button>
                        <button className="btn btn-primary btn-sm gap-2" onClick={handleSubmitUtilization}>
                            <Save size={16} /> Submit Utilization
                        </button>
                    </div>
                </div>
            </div>




            {/* Unified Master Inventory Table */}
            <div className="card mb-8 overflow-hidden p-0">
                <div className="p-4 border-b border-border bg-bg-secondary flex justify-between items-center">
                    <h3 className="font-bold text-lg">Inventory Breakdown</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted uppercase tracking-wider mr-2 hidden md:inline">
                            {kitItems.length} Kit Records • {inventoryItems.length} Additional
                        </span>
                        {canEdit && (
                            <button className="btn btn-sm btn-secondary" onClick={addNewItem}>
                                <Plus size={16} className="mr-2" /> Add Item
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-bg-secondary text-muted font-medium text-xs uppercase tracking-wider">
                            <tr>
                                <th className="py-3 px-4">Part No.</th>
                                <th className="py-3 px-4">Description</th>
                                <th className="py-3 px-4 w-32 text-center">Expected</th>
                                <th className="py-3 px-4 w-32 text-center">Actual</th>
                                <th className="py-3 px-4 w-32 text-center">Status</th>
                                <th className="py-3 px-4 w-24"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {/* SECTION 1: KIT ITEMS */}
                            <tr className="bg-bg-tertiary/50">
                                <td colSpan="6" className="py-2 px-4 font-bold text-xs uppercase tracking-wider text-primary border-b border-border">
                                    Kit Items
                                </td>
                            </tr>
                            {ConsolidatedKits.map((row) => {
                                const rawValue = kitEdits[row.key] !== undefined ? kitEdits[row.key] : row.actual;
                                const numValue = rawValue === '' ? 0 : (parseInt(rawValue) || 0);
                                const rowClass = getRowColor(rawValue, row.expected);

                                return (
                                    <tr key={row.key} className={`transition-colors ${rowClass}`}>
                                        <td className="py-2.5 px-4 font-medium text-text-primary">{row.partNumber}</td>
                                        <td className="py-2.5 px-4 text-muted">{row.description}</td>
                                        <td className="py-2.5 px-4 text-center font-mono">{row.expected}</td>
                                        <td className="py-2.5 px-4 text-center">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                className="input input-sm w-24 text-center font-bold inventory-qty-input"
                                                value={rawValue}
                                                onChange={(e) => handleKitActualChange(row.key, e.target.value)}
                                                onKeyDown={handleTableKeyDown}
                                                disabled={!canEdit || isLocked}
                                            />
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            <div className="flex justify-center">
                                                {numValue < row.expected ? (
                                                    <span className={`badge ${numValue < row.expected * 0.5 ? 'badge-error' : 'badge-warning'}`}>
                                                        Missing {row.expected - numValue}
                                                    </span>
                                                ) : (
                                                    <span className="text-success"><CheckCircle2 size={16} /></span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-4"></td>
                                    </tr>
                                );
                            })}
                            {ConsolidatedKits.length === 0 && (
                                <tr><td colSpan="6" className="p-4 text-center text-muted italic">No kit items found.</td></tr>
                            )}

                            {/* SECTION 2: ADDITIONAL ITEMS */}
                            <tr className="bg-bg-tertiary/50 border-t-2 border-border">
                                <td colSpan="6" className="py-2 px-4 font-bold text-xs uppercase tracking-wider text-accent-primary border-b border-border">
                                    Additional Items
                                </td>
                            </tr>
                            {VisibleInventoryItems.map((item) => {
                                const edited = invEdits[item.id] || {};
                                const quantity = edited.quantity !== undefined ? edited.quantity : item.quantity;
                                const isEditing = editingId === item.id;

                                return (
                                    <tr key={item.id} className="hover:bg-bg-tertiary transition-colors group">
                                        <td className="py-2.5 px-4 font-medium">
                                            {isEditing ? (
                                                <input
                                                    type="text" className="input input-sm w-full border-primary"
                                                    value={edited.partNumber !== undefined ? edited.partNumber : (item.partNumber || '')}
                                                    onChange={(e) => handleInvItemChange(item.id, 'partNumber', e.target.value)}
                                                />
                                            ) : (
                                                <span className="text-text-primary select-text">{edited.partNumber || item.partNumber}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-muted">
                                            {isEditing ? (
                                                <input
                                                    type="text" className="input input-sm w-full border-primary"
                                                    value={edited.description !== undefined ? edited.description : (item.description || '')}
                                                    onChange={(e) => handleInvItemChange(item.id, 'description', e.target.value)}
                                                />
                                            ) : (
                                                <span>{edited.description || item.description}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-center font-mono text-muted">0</td>
                                        <td className="py-2.5 px-4 text-center">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                className="input input-sm w-24 text-center font-bold inventory-qty-input"
                                                value={quantity}
                                                onChange={(e) => handleInvItemChange(item.id, 'quantity', e.target.value)}
                                                onKeyDown={handleTableKeyDown}
                                                disabled={!canEdit || isLocked}
                                            />
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            <div className="flex justify-center">
                                                {(parseInt(quantity) || 0) === 0 ? (
                                                    <span className="badge badge-error gap-1">
                                                        <AlertTriangle size={12} />
                                                        Critical
                                                    </span>
                                                ) : (
                                                    <span className="text-success"><CheckCircle2 size={16} /></span>
                                                )}
                                            </div>
                                        </td>
                                        {canEdit && (
                                            <td className="py-2.5 px-4 text-center">
                                                <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    {isEditing ? (
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="btn-icon text-success bg-success/10 p-1 rounded hover:bg-success/20"
                                                            title="Finish Editing"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingId(item.id)}
                                                                className="btn-icon text-muted hover:text-primary p-1 rounded hover:bg-bg-secondary"
                                                                title="Edit Item"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    await db.inventoryItems.delete(item.id);
                                                                    loadData();
                                                                }}
                                                                className="btn-icon text-muted hover:text-error p-1 rounded hover:bg-error/10"
                                                                title="Delete Item"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {VisibleInventoryItems.length === 0 && (
                                <tr><td colSpan="6" className="p-4 text-center text-muted italic">No additional items.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BLOCK 3: New Draft Items (Unchanged logic, just position) */}
            {
                newItems.length > 0 && (
                    <div className="card mb-24 overflow-hidden p-0 border border-primary/30 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                        <div className="p-4 border-b border-border bg-primary/5 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                <Plus size={18} />
                                New Items (Draft)
                            </h3>
                            <div className="flex gap-2">
                                <span className="text-xs text-muted">Unsaved Changes</span>
                                <button className="btn btn-primary btn-sm" onClick={handleSaveAll}>Save Now</button>
                            </div>
                        </div>
                        {/* ... Draft Table ... */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-bg-tertiary text-muted font-medium text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4">Part No.</th>
                                        <th className="py-3 px-4">Description</th>
                                        <th className="py-3 px-4 w-32 text-center">Expected</th>
                                        <th className="py-3 px-4 w-32 text-center">Actual</th>
                                        <th className="py-3 px-4 w-32 text-center">Status</th>
                                        <th className="py-3 px-4 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {newItems.map((item) => (
                                        <tr key={item.tempId} className="bg-bg-secondary/50">
                                            <td className="py-2.5 px-4">
                                                <input
                                                    type="text" className="input input-sm w-full border-primary"
                                                    placeholder="Part Number"
                                                    autoFocus
                                                    value={item.partNumber}
                                                    onChange={(e) => handleNewItemChange(item.tempId, 'partNumber', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <input
                                                    type="text" className="input input-sm w-full border-primary"
                                                    placeholder="Description"
                                                    value={item.description}
                                                    onChange={(e) => handleNewItemChange(item.tempId, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-2.5 px-4 text-center font-mono text-muted">0</td>
                                            <td className="py-2.5 px-4 text-center">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    className="input input-sm w-24 text-center border-primary font-bold inventory-qty-input"
                                                    value={item.quantity}
                                                    onChange={(e) => handleNewItemChange(item.tempId, 'quantity', e.target.value)}
                                                    onKeyDown={handleTableKeyDown}
                                                />
                                            </td>
                                            <td className="py-2.5 px-4 text-center">
                                                <span className="badge badge-sm badge-info">Draft</span>
                                            </td>
                                            <td className="py-2.5 px-4 text-center">
                                                <button className="text-muted hover:text-error transition-colors" onClick={() => removeNewItem(item.tempId)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Save FAB */}
            {/* Save FAB */}
            {
                canEdit && hasChanges && !isLoading && (
                    <div className="fixed bottom-8 right-8 z-50">
                        <button className="btn btn-primary shadow-xl py-3 px-6 rounded-full flex items-center gap-3 animate-pulse" onClick={handleSaveAll}>
                            <Save size={20} />
                            <span className="font-bold">Save Master Inventory</span>
                        </button>
                    </div>
                )
            }

            {/* Receive Modal */}
            {receivingShipment && createPortal(
                <div className="modal-backdrop">
                    <div className="bg-bg-primary border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-bg-secondary/30">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Truck size={20} className="text-primary" />
                                Receive Shipment: <span className="font-mono">{receivingShipment.uid}</span>
                            </h3>
                            <button className="btn-icon hover:bg-bg-secondary rounded-full p-1" onClick={() => setReceivingShipment(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="bg-bg-secondary/50 p-4 rounded-lg border border-border mb-6">
                                <label className="form-label font-bold mb-1 block">Date Received (Site Lead)</label>
                                <div className="text-xs text-muted mb-2">This date will be recorded as the official receipt date.</div>
                                <input
                                    type="date"
                                    className="input w-full bg-bg-primary border-border"
                                    value={receiveDate}
                                    onChange={(e) => setReceiveDate(e.target.value)}
                                />
                            </div>

                            <div className="mb-4">
                                <h4 className="font-bold mb-2 flex items-center gap-2">
                                    <Package size={16} className="text-muted" />
                                    Shipment Contents
                                </h4>
                                <p className="text-muted text-sm">
                                    Verify actual quantities received. Items with 0 quantity will be skipped.
                                    Added items will appear in the "Additional Items" section.
                                </p>
                            </div>

                            <ReceivingList
                                shipmentId={receivingShipment.id}
                                receiveQtys={receiveQtys}
                                setReceiveQtys={setReceiveQtys}
                            />
                            {/* 
                            <div className="p-4 border border-dashed text-center text-muted">
                                Items List Temporarily Disabled for Debugging
                            </div> 
                            */}
                        </div>

                        <div className="p-4 border-t border-border flex justify-end gap-2 bg-bg-secondary/30">
                            <button className="btn btn-ghost hover:bg-bg-secondary" onClick={() => setReceivingShipment(null)}>Cancel</button>
                            <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={handleReceiveSubmit}>
                                <CheckCircle2 size={18} />
                                Confirm & Add to Inventory
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
};

const ReceivingList = ({ shipmentId, receiveQtys, setReceiveQtys }) => {
    const [items, setItems] = useState([]);

    useEffect(() => {
        db.shipmentItems.where('shipmentId').equals(shipmentId).toArray().then(setItems);
    }, [shipmentId]);

    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <table className="table w-full">
                <thead className="bg-bg-secondary text-xs uppercase text-muted font-medium">
                    <tr>
                        <th className="px-4 py-2 text-left">Part No</th>
                        <th className="px-4 py-2 text-left">Desc</th>
                        <th className="px-4 py-2 text-center w-24">Shipped</th>
                        <th className="px-4 py-2 text-center w-32">Received</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {items.map(item => (
                        <tr key={item.id} className="hover:bg-bg-tertiary/50">
                            <td className="px-4 py-2 font-mono text-xs">{item.partNumber}</td>
                            <td className="px-4 py-2 text-xs truncate max-w-[150px]">{item.description}</td>
                            <td className="px-4 py-2 text-center">{item.quantity}</td>
                            <td className="px-4 py-2 text-center">
                                <input
                                    type="number"
                                    className="input input-sm w-full text-center border-primary/20"
                                    value={receiveQtys[item.id] !== undefined ? receiveQtys[item.id] : item.quantity}
                                    onChange={(e) => setReceiveQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Inventory;
