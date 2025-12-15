import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../db/schema';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import { Briefcase, Upload, FileSpreadsheet, ChevronDown, ChevronRight, Package, Trash2, AlertCircle, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const Kits = () => {
    const { user, canEdit } = useAuth(); // Assuming canEdit is exposed or derived
    const { deployments } = useDeployment();

    const [kits, setKits] = useState([]);
    const [kitItems, setKitItems] = useState({});
    const [dragActive, setDragActive] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);

    // Import State
    const [fileToImport, setFileToImport] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [kitName, setKitName] = useState('');
    const [kitVersion, setKitVersion] = useState('1.0');
    const [targetDeploymentId, setTargetDeploymentId] = useState('');
    const [expandedDeployments, setExpandedDeployments] = useState({});
    const [expandedKits, setExpandedKits] = useState({});

    useEffect(() => {
        loadKits();
    }, []);

    const loadKits = async () => {
        const loadedKits = await db.kits.toArray();
        // Sort by deployment, then name
        loadedKits.sort((a, b) => a.deploymentId - b.deploymentId || a.name.localeCompare(b.name));
        setKits(loadedKits);

        // Load items for all kits ? Or lazy load? 
        // For now, lazy load or load all if dataset is small. Let's load all for simplicity.
        const allItems = await db.kitItems.toArray();
        const itemsMap = {};
        allItems.forEach(item => {
            if (!itemsMap[item.kitId]) itemsMap[item.kitId] = [];
            itemsMap[item.kitId].push(item);
        });
        setKitItems(itemsMap);

        // Auto-expand all deployments by default
        const depIds = {};
        loadedKits.forEach(k => depIds[k.deploymentId] = true);
        setExpandedDeployments(depIds);
    };

    // --- Drag & Drop Handlers ---
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file) => {
        setFileToImport(file);
        setKitName(file.name.replace(/\.[^/.]+$/, "")); // Default name from filename

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Use first sheet or look for "Kit"?
                const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('kit')) || workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet);

                // Map fields
                const mappedItems = json.map(row => ({
                    partNumber: row['Part No.'] || row['Part Number'] || row['PN'] || '',
                    description: row['Part Description'] || row['Description'] || '',
                    quantity: row['Quantity'] || row['Qty'] || 1,
                    category: row['Location'] || row['Category'] || 'General',
                    serialNumber: row['S/N'] || row['S/N '] || row['Serial Number'] || row['Serial'] || ''
                })).filter(item => item.partNumber || item.description); // Filter empty rows

                setParsedData(mappedItems);
                setImportModalOpen(true);
            } catch (error) {
                alert('Error parsing file: ' + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const saveImport = async () => {
        if (!targetDeploymentId) {
            alert('Please select a deployment.');
            return;
        }

        setImporting(true);
        try {
            // 1. Create Kit
            const kitId = await db.kits.add({
                name: kitName,
                version: kitVersion,
                deploymentId: parseInt(targetDeploymentId),
                createdAt: new Date().toISOString()
            });

            // 2. Create Items
            const items = parsedData.map(item => ({
                kitId: kitId,
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.quantity,
                category: item.category,
                serialNumber: item.serialNumber
            }));

            await db.kitItems.bulkAdd(items);

            setImportModalOpen(false);
            setFileToImport(null);
            setParsedData([]);
            loadKits();
        } catch (error) {
            console.error('Save failed', error);
            alert('Failed to save kit.');
        } finally {
            setImporting(false);
        }
    };

    const deleteKit = async (id) => {
        if (confirm('Are you sure you want to delete this kit?')) {
            await db.kits.delete(id);
            await db.kitItems.where('kitId').equals(id).delete();
            loadKits();
        }
    };

    const toggleDeployment = (id) => {
        setExpandedDeployments(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleKit = (id) => {
        setExpandedKits(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // S/N Update Logic
    const [itemsToUpdate, setItemsToUpdate] = useState({});

    const handleSnChange = (itemId, value) => {
        setItemsToUpdate(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], serialNumber: value, noSn: false }
        }));
    };

    const handleNoSn = (itemId, checked) => {
        setItemsToUpdate(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                noSn: checked,
                serialNumber: checked ? 'N/A' : ''
            }
        }));
    };

    const saveKitUpdates = async (kitId) => {
        try {
            // Find items for this kit that have verified changes
            const kitItemList = kitItems[kitId] || [];
            const idsInKit = new Set(kitItemList.map(i => i.id));

            const updates = Object.keys(itemsToUpdate).filter(id => idsInKit.has(parseInt(id)));

            if (updates.length === 0) return;

            // Optional: Re-enable confirm if desired, but for now let's just save to ensure it works
            // if (!confirm(`Update ${updates.length} items in this kit?`)) return;

            await Promise.all(updates.map(id =>
                db.kitItems.update(parseInt(id), { serialNumber: itemsToUpdate[id].serialNumber })
            ));

            setItemsToUpdate(prev => {
                const next = { ...prev };
                updates.forEach(id => delete next[id]);
                return next;
            });

            await loadKits();
        } catch (error) {
            console.error('Failed to update kit items:', error);
            alert('Failed to save changes. Check console for details.');
        }
    };

    // Grouping Logic
    const groupedKits = {};
    deployments.forEach(d => groupedKits[d.id] = []);
    // Also handle kits for deleted deployments?
    kits.forEach(k => {
        if (!groupedKits[k.deploymentId]) groupedKits[k.deploymentId] = [];
        groupedKits[k.deploymentId].push(k);
    });

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <div className="page-header flex justify-between items-end">
                <div>
                    <h1 className="page-title flex items-center gap-3">
                        <Briefcase className="text-primary" />
                        Inventory Kits
                    </h1>
                    <p className="page-description">Manage standard inventory lists and expected kits for deployments.</p>
                </div>
            </div>

            {/* Drag & Drop Zone */}
            {canEdit && (
                <div
                    className={`border-2 border-dashed rounded-xl p-8 mb-8 text-center transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary/10' : 'border-border bg-bg-secondary hover:bg-bg-tertiary'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload').click()}
                >
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                    />
                    <Upload className={`mx-auto mb-4 ${dragActive ? 'text-primary' : 'text-muted'}`} size={48} />
                    <h3 className="text-lg font-medium mb-1">Upload Kit Inventory</h3>
                    <p className="text-sm text-muted">Drag & drop Excel or CSV file here, or click to browse</p>
                    <p className="text-xs text-muted mt-2">Expected Columns: "Part No.", "Part Description", "Quantity"</p>
                </div>
            )}

            {/* Kits List */}
            <div className="space-y-6">
                {Object.keys(groupedKits).map(depId => {
                    const deployment = deployments.find(d => d.id === parseInt(depId));
                    const deploymentKits = groupedKits[depId];
                    const isExpanded = expandedDeployments[depId];

                    if (!deployment && deploymentKits.length === 0) return null; // Skip empty unknown deployments

                    return (
                        <div key={depId} className="card overflow-hidden">
                            {/* Outer Container: Ship/Deployment */}
                            <div
                                className="bg-bg-tertiary p-4 flex items-center justify-between cursor-pointer select-none"
                                onClick={() => toggleDeployment(depId)}
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    <h3 className="font-bold text-lg">{deployment ? deployment.name : 'Unassigned / Archived DeploymentBox'}</h3>
                                    <span className="badge badge-secondary">{deploymentKits.length} Kits</span>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-4 space-y-4">
                                    {deploymentKits.length === 0 && (
                                        <p className="text-muted text-sm italic py-2 text-center">No kits assigned.</p>
                                    )}

                                    {deploymentKits.map(kit => {
                                        const isKitExpanded = expandedKits[kit.id];
                                        const items = kitItems[kit.id] || [];

                                        const pendingCount = Object.keys(itemsToUpdate).filter(id =>
                                            items.some(i => i.id === parseInt(id))
                                        ).length;

                                        return (
                                            <div key={kit.id} className="border border-border rounded-lg overflow-hidden bg-bg-secondary/20">
                                                {/* Inner Container: Kit Header */}
                                                <div
                                                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-bg-tertiary transition-colors"
                                                    onClick={() => toggleKit(kit.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {isKitExpanded ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
                                                        <Package size={20} className="text-accent-primary" />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-base">{kit.name}</span>
                                                                <span className="badge badge-sm badge-secondary">v{kit.version}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs text-muted font-medium">{items.length} Items</span>

                                                        {/* Save Button */}
                                                        {pendingCount > 0 && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); saveKitUpdates(kit.id); }}
                                                                className="btn btn-xs btn-primary gap-1.5 flex items-center animate-bounce-in"
                                                            >
                                                                <Save size={14} />
                                                                Save ({pendingCount})
                                                            </button>
                                                        )}

                                                        {canEdit && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); deleteKit(kit.id); }}
                                                                className="btn-icon text-muted hover:text-error"
                                                                title="Delete Kit"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Kit Items Table */}
                                                {isKitExpanded && (
                                                    <div className="border-t border-border bg-bg-primary/30">
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm text-left">
                                                                <thead className="bg-bg-secondary text-muted font-medium text-xs uppercase tracking-wider">
                                                                    <tr>
                                                                        <th className="py-2 px-4 w-16 text-center">Qty</th>
                                                                        <th className="py-2 px-4 w-1/4">Part No.</th>
                                                                        <th className="py-2 px-4">Description</th>
                                                                        <th className="py-2 px-4 w-64 lg:w-80">Serial Number</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-border">
                                                                    {items.map((item, idx) => {
                                                                        const draft = itemsToUpdate[item.id];
                                                                        const displaySn = draft ? draft.serialNumber : (item.serialNumber || '');
                                                                        const isNoSn = draft ? draft.noSn : (item.serialNumber === 'N/A');

                                                                        return (
                                                                            <tr key={idx} className="hover:bg-bg-secondary/50 transition-colors">
                                                                                <td className="py-2.5 px-4 font-mono text-center text-accent-primary">{item.quantity}</td>
                                                                                <td className="py-2.5 px-4 font-medium">{item.partNumber}</td>
                                                                                <td className="py-2.5 px-4 text-muted">{item.description}</td>
                                                                                <td className="py-2.5 px-4">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <input
                                                                                            type="text"
                                                                                            className={`input input-sm w-full h-8 text-xs font-mono ${draft ? 'border-primary ring-1 ring-primary/20' : 'bg-black/20 border-transparent hover:border-border'}`}
                                                                                            placeholder={isNoSn ? "N/A" : "Enter S/N..."}
                                                                                            value={displaySn}
                                                                                            onChange={(e) => handleSnChange(item.id, e.target.value)}
                                                                                            disabled={!canEdit || isNoSn}
                                                                                        />
                                                                                        <div
                                                                                            className="flex items-center gap-1.5 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                                                                                            onClick={() => canEdit && handleNoSn(item.id, !isNoSn)}
                                                                                            title="Mark as No S/N"
                                                                                        >
                                                                                            <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${isNoSn ? 'bg-primary border-primary' : 'border-muted hover:border-text-primary'}`}>
                                                                                                {isNoSn && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Import Modal */}
            {importModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal max-w-lg">
                        <div className="modal-header">
                            <h3 className="modal-title">Import Kit</h3>
                        </div>
                        <div className="modal-body space-y-4">
                            <div className="bg-bg-tertiary p-3 rounded flex items-center gap-3">
                                <FileSpreadsheet className="text-success" />
                                <div className="overflow-hidden">
                                    <div className="font-medium truncate">{fileToImport?.name}</div>
                                    <div className="text-xs text-muted">{parsedData.length} valid items found</div>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Kit Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={kitName}
                                    onChange={e => setKitName(e.target.value)}
                                    placeholder="e.g. Standard Loadout"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Version</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={kitVersion}
                                        onChange={e => setKitVersion(e.target.value)}
                                        placeholder="1.0"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Assign to Ship/Deployment</label>
                                    <select
                                        className="select"
                                        value={targetDeploymentId}
                                        onChange={e => setTargetDeploymentId(e.target.value)}
                                    >
                                        <option value="">Select Deployment...</option>
                                        {deployments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded text-sm text-blue-200">
                                <AlertCircle size={16} className="inline mr-2" />
                                This will create a new kit record with {parsedData.length} items.
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setImportModalOpen(false)}
                                disabled={importing}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveImport}
                                disabled={importing || !targetDeploymentId}
                            >
                                {importing ? 'Importing...' : 'Create Kit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Kits;
