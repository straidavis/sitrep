import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Save, Calendar, Search } from 'lucide-react';
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import Modal from '../components/Modal';
import EquipmentForm from '../components/EquipmentForm';
import { getAllEquipment, addEquipment, updateEquipment } from '../db/equipment';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';

const Equipment = () => {
    const { canEdit } = useAuth();

    const [allEquipmentData, setAllEquipmentData] = useState([]);
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [localChanges, setLocalChanges] = useState({});
    const [showModal, setShowModal] = useState(false);
    // eslint-disable-next-line no-unused-vars
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const dateInputRef = useRef(null);

    const { selectedDeploymentIds, deployments } = useDeployment();

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
            // Filter by deployment if selected
            const filtered = (selectedDeploymentIds && selectedDeploymentIds.length > 0)
                ? data.filter(item => selectedDeploymentIds.includes(item.deploymentId))
                : data;
            setAllEquipmentData(filtered);
            setLocalChanges({}); // Reset local changes on reload
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 1. Identify all unique equipment items
    const uniqueItems = useMemo(() => {
        const unique = new Map();
        allEquipmentData.forEach(item => {
            const key = `${item.category}|${item.equipment}|${item.serialNumber}`;
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
    }, [allEquipmentData]);

    // 2. Prepare display data for the selected date
    const displayData = useMemo(() => {
        const result = [];
        const targetDate = startOfDay(parseISO(selectedDate));
        const isTodayOrFuture = targetDate >= startOfDay(new Date());

        uniqueItems.forEach(item => {
            const key = `${item.category}|${item.equipment}|${item.serialNumber}`;

            const recordForDate = allEquipmentData.find(d =>
                d.category === item.category &&
                d.equipment === item.equipment &&
                d.serialNumber === item.serialNumber &&
                isSameDay(parseISO(d.date), targetDate)
            );

            let effectiveRecord = recordForDate;
            let isCarryOver = false;

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
                key,
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

    const handleStatusChange = (key, newStatus) => {
        if (!canEdit) return;
        setLocalChanges(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                status: newStatus
            }
        }));
    };

    const handleNotesChange = (key, newNotes) => {
        if (!canEdit) return;
        setLocalChanges(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                comments: newNotes
            }
        }));
    };

    const handleUpdateAll = async () => {
        if (!canEdit) return;
        if (!confirm(`Save status updates for ${selectedDate}?`)) return;

        setIsSaving(true);
        try {
            const promises = displayData
                .filter(item => item.isModified || item.isCarryOver)
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

                    if (item.hasRecord && item.id) {
                        return updateEquipment(item.id, dataToSave);
                    } else {
                        return addEquipment(dataToSave);
                    }
                });

            await Promise.all(promises);
            await loadData();
            alert('Status updated successfully');
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

    const handleDateClick = () => {
        if (dateInputRef.current) {
            if (dateInputRef.current.showPicker) {
                dateInputRef.current.showPicker();
            } else {
                dateInputRef.current.focus();
                dateInputRef.current.click();
            }
        }
    };

    const getStatusColors = (status) => {
        switch (status) {
            case 'FMC': return { text: 'var(--color-success)', bg: 'rgba(34, 197, 94, 0.1)', border: 'var(--color-success)', opacity: 1 };
            case 'PMC': return { text: 'var(--color-warning)', bg: 'rgba(234, 179, 8, 0.1)', border: 'var(--color-warning)', opacity: 1 };
            case 'NMC': return { text: 'var(--color-error)', bg: 'rgba(239, 68, 68, 0.1)', border: 'var(--color-error)', opacity: 1 };
            case 'CAT5': return { text: 'var(--color-text-disabled)', bg: 'rgba(15, 23, 42, 0.3)', border: 'var(--color-text-disabled)', opacity: 0.6 };
            default: return { text: 'var(--color-text-primary)', bg: 'transparent', border: 'var(--color-border)', opacity: 1 };
        }
    };

    const renderTable = (items) => {
        return (
            <div className="card overflow-hidden p-0">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary text-muted font-medium text-xs">
                        <tr>
                            <th className="px-3 py-2 w-1/3">Equipment</th>
                            <th className="px-3 py-2 w-1/4">Status</th>
                            <th className="px-3 py-2">Notes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.map(item => {
                            const colors = getStatusColors(item.status || 'FMC');
                            return (
                                <tr
                                    key={item.key}
                                    className="transition-colors"
                                    style={{
                                        backgroundColor: colors.bg,
                                        opacity: colors.opacity
                                    }}
                                >
                                    <td className="px-3 py-1.5 align-middle">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: colors.text }}
                                            ></div>
                                            <div className="flex flex-col leading-tight">
                                                <span className="font-medium text-sm" style={{ color: item.status === 'CAT5' ? 'var(--color-text-disabled)' : 'var(--color-text-primary)' }}>{item.equipment}</span>
                                                <span className="text-xs text-muted font-mono">{item.serialNumber}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 align-middle">
                                        <select
                                            className="select select-sm w-full font-medium text-xs py-1 h-8"
                                            value={item.status || 'FMC'}
                                            onChange={(e) => handleStatusChange(item.key, e.target.value)}
                                            disabled={!canEdit}
                                            style={{
                                                color: colors.text,
                                                borderColor: item.isModified ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                                backgroundColor: 'rgba(0,0,0,0.2)',
                                                cursor: !canEdit ? 'not-allowed' : 'pointer',
                                                opacity: !canEdit ? 0.7 : 1
                                            }}
                                        >
                                            {statuses.map(s => (
                                                <option key={s.value} value={s.value}>{s.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-3 py-1.5 align-middle">
                                        <input
                                            type="text"
                                            className="input input-sm w-full bg-transparent border-transparent hover:border-border focus:border-primary transition-colors text-xs h-8"
                                            placeholder={canEdit ? "Add notes..." : ""}
                                            value={item.comments || ''}
                                            onChange={(e) => handleNotesChange(item.key, e.target.value)}
                                            disabled={!canEdit}
                                            style={{
                                                color: item.status === 'CAT5' ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)',
                                                cursor: !canEdit ? 'default' : 'text'
                                            }}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderCategoryTable = (category) => {
        const categoryItems = displayData
            .filter(d => d.category === category)
            .sort((a, b) => {
                if (a.status === 'CAT5' && b.status !== 'CAT5') return 1;
                if (a.status !== 'CAT5' && b.status === 'CAT5') return -1;
                return 0;
            });

        if (categoryItems.length === 0) return null;

        const isPastDate = !isSameDay(parseISO(selectedDate), new Date());
        const dateStamp = isPastDate ? format(parseISO(selectedDate), 'MM/dd') : '';

        return (
            <div key={category} className="mb-4">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider">{category}</h3>
                    {dateStamp && <span className="text-xs text-muted opacity-70 font-mono">{dateStamp}</span>}
                </div>

                {(!selectedDeploymentIds || selectedDeploymentIds.length !== 1) ? (
                    <div className="flex flex-col gap-4">
                        {Object.values(categoryItems.reduce((acc, item) => {
                            const depId = item.deploymentId || 'unknown';
                            if (!acc[depId]) acc[depId] = [];
                            acc[depId].push(item);
                            return acc;
                        }, {})).map((depItems, index) => {
                            const depName = deployments.find(d => d.id === depItems[0].deploymentId)?.name || 'Unknown Deployment';
                            return (
                                <div key={index}>
                                    <div className="text-[10px] font-semibold text-accent-primary mb-1 pl-1 uppercase tracking-wider opacity-80">
                                        {depName}
                                    </div>
                                    {renderTable(depItems)}
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
        <div className="pb-20">
            {/* Header Controls */}
            <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur border-b border-border py-3 mb-4 -mx-6 px-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="page-title mb-1 text-xl">Equipment Status</h1>
                        <div className="flex items-center gap-4 text-sm">
                            <div
                                className="relative flex items-center bg-secondary/50 rounded-lg border border-border px-4 py-2 gap-3 hover:bg-secondary transition-colors cursor-pointer group min-w-[200px]"
                                onClick={handleDateClick}
                            >
                                <Calendar size={18} className="text-accent-primary group-hover:text-accent-primary-hover flex-shrink-0" />
                                <div className="flex flex-col justify-center">
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-bold leading-tight mb-0.5 block">Viewing Date</span>
                                    <span className="font-medium text-sm leading-tight text-primary block whitespace-nowrap">
                                        {format(parseISO(selectedDate), 'EEE, MMM d, yyyy')}
                                    </span>
                                </div>
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    className="hidden"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                            {selectedDeploymentIds && selectedDeploymentIds.length > 0 && (
                                <span className="badge badge-info text-xs py-0.5">
                                    Deployed
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-48">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                className="input w-full py-1 text-sm h-9"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.5rem' }}
                            />
                        </div>
                        {canEdit && (
                            <button className="btn btn-secondary btn-sm h-9" onClick={handleAddEquipment}>
                                <Plus size={16} />
                                <span className="hidden sm:inline">Add New</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="max-w-full mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {categories.map(category => renderCategoryTable(category))}
                    </div>

                    {displayData.length === 0 && (
                        <div className="text-center py-12 text-muted">
                            <p>No equipment found for this deployment.</p>
                            {canEdit && (
                                <button className="btn btn-link mt-2" onClick={handleAddEquipment}>
                                    Add your first equipment
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Floating Action Bar */}
            {canEdit && (
                <div className="fixed bottom-6 right-6 z-20">
                    <button
                        className={`btn btn-primary shadow-lg transform transition-all ${isSaving ? 'scale-95 opacity-80' : 'hover:scale-105'}`}
                        onClick={handleUpdateAll}
                        style={{ padding: '10px 20px', borderRadius: '50px' }}
                    >
                        {isSaving ? (
                            <div className="spinner w-4 h-4 border-white"></div>
                        ) : (
                            <Save size={18} />
                        )}
                        <span className="ml-2 font-bold text-sm">Update All</span>
                    </button>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <Modal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    title="Add New Equipment"
                >
                    <EquipmentForm
                        equipment={null}
                        onSave={async (data) => {
                            await addEquipment({
                                ...data,
                                deploymentId: (selectedDeploymentIds && selectedDeploymentIds.length === 1) ? parseInt(selectedDeploymentIds[0]) : null
                            });
                            setShowModal(false);
                            loadData();
                        }}
                        onCancel={() => setShowModal(false)}
                    />
                </Modal>
            )}
        </div>
    );
};

export default Equipment;
