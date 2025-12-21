import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Save, Calendar, Search, Edit2, AlertTriangle, Clock, Check } from 'lucide-react';
import { format, isSameDay, parseISO, startOfDay, differenceInDays } from 'date-fns';
import Modal from '../components/Modal';
import EquipmentForm from '../components/EquipmentForm';
import { getAllEquipment, addEquipment, updateEquipment } from '../db/equipment';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';

const Equipment = () => {
    const { canEdit } = useAuth();
    const { selectedDeploymentIds, deployments } = useDeployment();

    const [allEquipmentData, setAllEquipmentData] = useState([]);
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [localChanges, setLocalChanges] = useState({});

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const dateInputRef = useRef(null);

    const categories = ['Aircraft', 'Payloads', 'Launchers', 'GCS', 'Radios'];
    const statuses = [
        { value: 'FMC', label: 'FMC', color: 'green' },
        { value: 'PMC', label: 'PMC', color: 'yellow' },
        { value: 'NMC', label: 'NMC', color: 'red' },
        { value: 'CAT5', label: 'CAT5', color: 'grey' }
    ];

    useEffect(() => {
        loadData();
    }, [selectedDeploymentIds]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const data = await getAllEquipment();
            // Optional: Client-side filtering if needed, but we keep all loaded and filter in render for performance
            setAllEquipmentData(data);
            setLocalChanges({});
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Derived Data: Unique Equipment Filtered by Deployment
    const uniqueItems = useMemo(() => {
        const unique = new Map();

        // 1. Filter raw data first based on selected context
        const filteredRaw = (selectedDeploymentIds && selectedDeploymentIds.length > 0)
            ? allEquipmentData.filter(item => selectedDeploymentIds.includes(item.deploymentId))
            : allEquipmentData;

        filteredRaw.forEach(item => {
            const key = `${item.category}|${item.equipment}|${item.serialNumber}`;
            // If duplicate exists, prefer the most recent entry
            if (!unique.has(key)) {
                unique.set(key, {
                    category: item.category,
                    equipment: item.equipment,
                    serialNumber: item.serialNumber,
                    deploymentId: item.deploymentId
                });
            }
        });
        return Array.from(unique.values());
    }, [allEquipmentData, selectedDeploymentIds]);

    // Prepare Display Data
    const displayData = useMemo(() => {
        const result = [];
        const targetDate = startOfDay(parseISO(selectedDate));
        const isTodayOrFuture = targetDate >= startOfDay(new Date());

        uniqueItems.forEach(item => {
            const key = `${item.category}|${item.equipment}|${item.serialNumber}`;

            // Find specific record for this date
            const recordForDate = allEquipmentData.find(d =>
                d.category === item.category &&
                d.equipment === item.equipment &&
                d.serialNumber === item.serialNumber &&
                isSameDay(parseISO(d.date), targetDate)
            );

            let effectiveRecord = recordForDate;
            let isCarryOver = false;

            // If no record today, find last known status
            if (!recordForDate && isTodayOrFuture) {
                const previousRecords = allEquipmentData.filter(d =>
                    d.category === item.category &&
                    d.equipment === item.equipment &&
                    d.serialNumber === item.serialNumber &&
                    parseISO(d.date) < targetDate
                ).sort((a, b) => new Date(b.date) - new Date(a.date));

                if (previousRecords.length > 0) {
                    effectiveRecord = { ...previousRecords[0], id: null };
                    isCarryOver = true;
                }
            }

            const changes = localChanges[key] || {};

            const finalRecord = {
                ...item,
                ...(effectiveRecord || {}),
                ...changes,
                key, // Unique key for react list
                originalId: recordForDate?.id, // ID to update if exists
                isCarryOver,
                hasRecord: !!recordForDate,
                isModified: Object.keys(changes).length > 0
            };

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!finalRecord.equipment.toLowerCase().includes(term) &&
                    !finalRecord.serialNumber.toLowerCase().includes(term)) {
                    return;
                }
            }

            result.push(finalRecord);
        });

        return result;
    }, [uniqueItems, allEquipmentData, selectedDate, localChanges, searchTerm]);

    // Handlers
    const handleStatusChange = (key, newStatus) => {
        if (!canEdit) return;
        setLocalChanges(prev => ({
            ...prev,
            [key]: { ...prev[key], status: newStatus }
        }));
    };

    const handleNotesChange = (key, newNotes) => {
        if (!canEdit) return;
        setLocalChanges(prev => ({
            ...prev,
            [key]: { ...prev[key], comments: newNotes }
        }));
    };

    const handleUpdateAll = async () => {
        if (!canEdit) return;
        if (!confirm(`Save/Validate status for all ${displayData.length} items for ${selectedDate}?`)) return;

        setIsSaving(true);
        try {
            const promises = displayData
                .map(item => {
                    const dataToSave = {
                        date: new Date(selectedDate).toISOString(),
                        category: item.category,
                        equipment: item.equipment,
                        serialNumber: item.serialNumber,
                        status: item.status || 'FMC',
                        location: item.location || '',
                        software: item.software || '',
                        comments: item.comments || '',
                        deploymentId: item.deploymentId
                    };

                    // If modifying an existing record for TODAY, update it.
                    // If carrying over or creating new daily record, ADD it.
                    if (item.hasRecord && item.originalId) {
                        return updateEquipment(item.originalId, dataToSave);
                    } else {
                        return addEquipment(dataToSave);
                    }
                });

            await Promise.all(promises);
            await loadData();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddEquipment = () => {
        if (!canEdit) return;
        setSelectedEquipment(null);
        setShowModal(true);
    };

    const handleEditEquipment = (item) => {
        if (!canEdit) return;
        // Reconstruct the full object expected by the form
        setSelectedEquipment({
            ...item,
        });
        setShowModal(true);
    };

    const handleSaveForm = async (data) => {
        try {
            if (selectedEquipment && selectedEquipment.originalId) {
                await updateEquipment(selectedEquipment.originalId, data);
            } else {
                await addEquipment(data);
            }
            setShowModal(false);
            loadData();
        } catch (e) {
            console.error(e);
            alert('Save failed');
        }
    };

    const handleDateClick = () => {
        dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.click();
    };

    const getStatusColors = (status) => {
        switch (status) {
            case 'FMC': return { text: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', opacity: 1 };
            case 'PMC': return { text: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', opacity: 1 };
            case 'NMC': return { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', opacity: 1 };
            case 'CAT5': return { text: '#94a3b8', bg: 'rgba(63, 63, 70, 0.4)', opacity: 0.8 }; // Grey/Zinc
            default: return { text: '#f8fafc', bg: 'transparent', opacity: 1 };
        }
    };

    // Render Helpers
    const renderTable = (items) => (
        <div className="card overflow-hidden p-0 mb-6">
            <table className="w-full text-sm text-left">
                <thead className="bg-bg-secondary text-muted font-medium text-xs">
                    <tr>
                        <th className="px-4 py-3 w-[30%]">Equipment</th>
                        <th className="px-4 py-3 w-[20%]">Status</th>
                        <th className="px-4 py-3 w-[15%]">Last Updated</th>
                        <th className="px-4 py-3">Notes</th>
                        {canEdit && <th className="px-4 py-3 w-[50px]"></th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {items.map(item => {
                        const colors = getStatusColors(item.status || 'FMC');

                        // Last Updated Logic
                        const itemDate = item.date ? parseISO(item.date) : new Date();
                        const daysSinceUpdate = differenceInDays(new Date(), itemDate);
                        const dep = deployments.find(d => d.id === item.deploymentId);
                        const isDeploymentActive = dep?.status === 'Active';

                        const isStale = isDeploymentActive && daysSinceUpdate > 1;

                        return (
                            <tr key={item.key} className="transition-colors hover:bg-bg-tertiary" style={{ backgroundColor: colors.bg, opacity: colors.opacity }}>
                                <td className="px-4 py-3 align-middle">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: colors.text }}></div>
                                        <div>
                                            <div className="font-medium text-text-primary">{item.equipment}</div>
                                            <div className="text-xs text-muted font-mono bg-black/20 px-1 rounded inline-block">{item.serialNumber}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 align-middle">
                                    <select
                                        className="select select-sm w-full font-medium text-xs h-8 border-none bg-black/20 focus:bg-black/40"
                                        value={item.status || 'FMC'}
                                        onChange={(e) => handleStatusChange(item.key, e.target.value)}
                                        disabled={!canEdit}
                                        style={{ color: colors.text }}
                                    >
                                        {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </td>
                                <td className="px-4 py-3 align-middle">
                                    <div className={`flex items-center gap-2 text-xs font-medium ${isStale ? 'text-warning' : 'text-muted'}`} title={isStale ? "Status outdated (> 24h)" : `Updated: ${format(itemDate, 'MMM d, yyyy')}`}>
                                        {isStale ? <AlertTriangle size={14} /> : <Clock size={14} />}
                                        <span>
                                            {isSameDay(itemDate, new Date())
                                                ? 'Today'
                                                : `${daysSinceUpdate} day${daysSinceUpdate !== 1 ? 's' : ''} ago`}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 align-middle">
                                    <input
                                        type="text"
                                        className="input input-sm w-full bg-transparent border-transparent hover:border-border focus:border-primary text-xs h-8"
                                        placeholder={canEdit ? "Add notes..." : ""}
                                        value={item.comments || ''}
                                        onChange={(e) => handleNotesChange(item.key, e.target.value)}
                                        disabled={!canEdit}
                                    />
                                </td>
                                {canEdit && (
                                    <td className="px-2 py-3 align-middle text-right">
                                        <button
                                            className="btn-icon p-1 text-muted hover:text-primary"
                                            onClick={() => handleEditEquipment(item)}
                                            title="Edit Details"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderCategoryTable = (category) => {
        const categoryItems = displayData.filter(d => d.category === category);
        if (categoryItems.length === 0) return null;

        return (
            <div key={category} className="mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-accent-primary rounded-full"></span>
                        {category}
                    </h3>
                    <span className="badge badge-secondary text-xs">{categoryItems.length}</span>
                </div>

                {/* Group by Deployment if multiple selected */}
                {(!selectedDeploymentIds || selectedDeploymentIds.length !== 1) ? (
                    <div className="space-y-4">
                        {Object.values(categoryItems.reduce((acc, item) => {
                            const depId = item.deploymentId || 'unknown';
                            if (!acc[depId]) acc[depId] = [];
                            acc[depId].push(item);
                            return acc;
                        }, {})).map((depItems, idx) => {
                            const depName = deployments.find(d => d.id === depItems[0].deploymentId)?.name || 'Unassigned / Unknown';
                            return (
                                <div key={idx} className="relative">
                                    <div className="absolute -left-3 top-3 bottom-3 w-0.5 bg-border"></div>
                                    <div className="pl-0">
                                        <div className="text-[10px] font-bold text-accent-primary mb-1 uppercase tracking-wider">{depName}</div>
                                        {renderTable(depItems)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    renderTable(categoryItems)
                )}
            </div>
        );
    };

    return (
        <div className="pb-24 max-w-7xl mx-auto">
            {/* Header Controls */}
            <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur border-b border-border py-4 mb-6 shadow-sm -mx-6 px-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="page-title text-xl m-0">Equipment Status</h1>
                        <div className="h-6 w-px bg-border"></div>
                        <div
                            className="flex items-center gap-2 bg-bg-secondary px-3 py-1.5 rounded-lg border border-border hover:border-primary transition-colors cursor-pointer group"
                            onClick={handleDateClick}
                        >
                            <Calendar size={16} className="text-muted group-hover:text-primary" />
                            <span className="text-sm font-medium">{format(parseISO(selectedDate), 'MMM d, yyyy')}</span>
                            <input ref={dateInputRef} type="date" className="hidden" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text" className="input w-full pl-9 h-10 bg-bg-secondary border-transparent focus:bg-bg-primary"
                                placeholder="Search equipment..."
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {canEdit && (
                            <button className="btn btn-primary h-10 px-4" onClick={handleAddEquipment}>
                                <Plus size={18} className="mr-2" />
                                <span className="font-semibold">Add New</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            {isLoading ? (
                <div className="flex justify-center py-20"><div className="spinner"></div></div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-2">
                        {renderCategoryTable('Aircraft')}
                        {renderCategoryTable('Payloads')}
                    </div>
                    {/* Right Column */}
                    <div className="space-y-2">
                        {renderCategoryTable('Launchers')}
                        {renderCategoryTable('GCS')}
                        {renderCategoryTable('Radios')}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && displayData.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
                    <p className="text-muted text-lg">No equipment found.</p>
                    {canEdit && <button className="btn btn-link mt-2" onClick={handleAddEquipment}>Add Item</button>}
                </div>
            )}

            {/* Save / Validate FAB */}
            {canEdit && isSaving === false && displayData.length > 0 && (
                <div className="fixed bottom-8 right-8 z-30 animate-bounce-in">
                    <button
                        className={`btn shadow-xl py-3 px-6 rounded-full flex items-center gap-3 ${Object.keys(localChanges).length > 0 ? 'btn-primary' : 'btn-success'}`}
                        onClick={handleUpdateAll}
                    >
                        {Object.keys(localChanges).length > 0 ? (
                            <>
                                <Save size={20} />
                                <span className="font-bold">Save Changes</span>
                            </>
                        ) : (
                            <>
                                <Check size={20} />
                                <span className="font-bold">Validate All Statuses</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={selectedEquipment ? "Edit Equipment Details" : "Add New Equipment"}>
                    <EquipmentForm
                        equipment={selectedEquipment}
                        // Determine default ID: If 1 deployment selected in context, use it.
                        defaultDeploymentId={(selectedDeploymentIds && selectedDeploymentIds.length === 1) ? selectedDeploymentIds[0] : ''}
                        onSave={handleSaveForm}
                        onCancel={() => setShowModal(false)}
                    />
                </Modal>
            )}
        </div>
    );
};

export default Equipment;
