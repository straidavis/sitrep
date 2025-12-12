import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../db/schema';
import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';
import { Briefcase, Upload, FileSpreadsheet, ChevronDown, ChevronRight, Package, Trash2, AlertCircle } from 'lucide-react';
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
                    category: row['Location'] || row['Category'] || 'General' // Using Location as category/grouping
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
                category: item.category
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

                                        return (
                                            <div key={kit.id} className="border border-border rounded-lg overflow-hidden bg-bg-primary/50">
                                                {/* Inner Container: Kit Header */}
                                                <div
                                                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-bg-tertiary transition-colors"
                                                    onClick={() => toggleKit(kit.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {isKitExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        <Package size={18} className="text-accent-primary" />
                                                        <div>
                                                            <span className="font-semibold">{kit.name}</span>
                                                            <span className="text-xs text-muted ml-2">v{kit.version}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs text-muted">{items.length} Items</span>
                                                        {canEdit && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); deleteKit(kit.id); }}
                                                                className="text-muted hover:text-error"
                                                                title="Delete Kit"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Kit Items Table */}
                                                {isKitExpanded && (
                                                    <div className="border-t border-border">
                                                        <div className="overflow-x-auto">
                                                            <table className="table w-full text-sm">
                                                                <thead>
                                                                    <tr className="bg-bg-secondary text-left">
                                                                        <th className="py-2 px-4 w-16">Qty</th>
                                                                        <th className="py-2 px-4">Part No.</th>
                                                                        <th className="py-2 px-4">Description</th>
                                                                        <th className="py-2 px-4">Category</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {items.map((item, idx) => (
                                                                        <tr key={idx} className="border-b border-border last:border-0 hover:bg-bg-secondary/50">
                                                                            <td className="py-2 px-4 font-mono text-center">{item.quantity}</td>
                                                                            <td className="py-2 px-4 font-medium text-accent-primary">{item.partNumber}</td>
                                                                            <td className="py-2 px-4 text-secondary">{item.description}</td>
                                                                            <td className="py-2 px-4 text-xs text-muted">{item.category}</td>
                                                                        </tr>
                                                                    ))}
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
