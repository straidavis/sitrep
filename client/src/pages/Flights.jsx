import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Search, Filter, Edit, Trash2, Download, Upload, Eye } from 'lucide-react';
import Modal from '../components/Modal';
import FlightForm from '../components/FlightForm';
import {
    getAllFlights,
    addFlight,
    updateFlight,
    deleteFlight
} from '../db/flights';
import { format } from 'date-fns';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';
import { getResponsibleParty } from '../utils/constants';

const Flights = () => {
    const { canEdit } = useAuth();

    const [flights, setFlights] = useState([]);
    const [filteredFlights, setFilteredFlights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: '',

        startDate: '',
        endDate: ''
    });

    const { selectedDeploymentIds, deployments } = useDeployment();

    // Import State
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [fileToImport, setFileToImport] = useState(null);
    const [parsedFlights, setParsedFlights] = useState([]);
    const [targetDeploymentId, setTargetDeploymentId] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

    const [showModal, setShowModal] = useState(false);
    const [editingFlight, setEditingFlight] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadFlights();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [flights, searchTerm, filters, selectedDeploymentIds]);

    const loadFlights = async () => {
        try {
            setLoading(true);
            const data = await getAllFlights();
            setFlights(data);
        } catch (error) {
            console.error('Error loading flights:', error);
            alert('Failed to load flights');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...flights];

        // Global Deployment Filter
        if (selectedDeploymentIds && selectedDeploymentIds.length > 0) {
            filtered = filtered.filter(f => selectedDeploymentIds.includes(f.deploymentId));
        }

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(flight =>
                flight.aircraftNumber?.toLowerCase().includes(term) ||
                flight.missionNumber?.toLowerCase().includes(term) ||
                flight.reason?.toLowerCase().includes(term) ||
                flight.notes?.toLowerCase().includes(term)
            );
        }

        // Status filter
        if (filters.status) {
            filtered = filtered.filter(f => f.status === filters.status);
        }

        // Risk level filter


        // Date range filter
        if (filters.startDate) {
            filtered = filtered.filter(f => f.date >= new Date(filters.startDate).toISOString());
        }
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59);
            filtered = filtered.filter(f => f.date <= endDate.toISOString());
        }

        setFilteredFlights(filtered);
    };

    const handleAddFlight = () => {
        if (!canEdit) return;
        setEditingFlight(null);
        setShowModal(true);
    };

    const handleEditFlight = (flight) => {
        setEditingFlight(flight);
        setShowModal(true);
    };

    const handleSaveFlight = async (flightData) => {
        try {
            if (editingFlight) {
                await updateFlight(editingFlight.id, flightData);
            } else {
                // If a single deployment is selected globally, auto-assign it
                if (selectedDeploymentIds && selectedDeploymentIds.length === 1 && !flightData.deploymentId) {
                    flightData.deploymentId = parseInt(selectedDeploymentIds[0]);
                }
                await addFlight(flightData);
            }
            setShowModal(false);
            setEditingFlight(null);
            await loadFlights();
        } catch (error) {
            console.error('Error saving flight:', error);
            alert('Failed to save flight');
        }
    };



    // --- Import Handlers ---

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
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
                // Get raw data with header:1 to map columns manually
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (jsonData.length < 2) {
                    alert('File appears empty or missing headers');
                    return;
                }

                // Find Header Row (look for specific columns)
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
                    const row = jsonData[i];
                    if (!row) continue;
                    const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
                    if (rowStr.includes('date') && rowStr.includes('status')) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    alert('Could not find header row (looking for "Date" and "Status")');
                    return;
                }

                const headers = jsonData[headerRowIdx].map(h => String(h).trim().toLowerCase());
                const rows = jsonData.slice(headerRowIdx + 1);

                const getIdx = (name) => headers.findIndex(h => h.includes(name));

                // Column Sigs
                const colDate = getIdx('date'); // 0
                const colStatus = getIdx('status'); // 1

                if (colDate === -1 || colStatus === -1) {
                    alert('Critical columns missing. Found: ' + headers.join(', '));
                    return;
                }

                const colMission = getIdx('mission #') !== -1 ? getIdx('mission #') : getIdx('mission');
                const colAircraft = getIdx('aircraft');
                const colSched = getIdx('scheduled');
                const colLaunch = getIdx('launch time');
                const colRecovery = getIdx('recovery');
                const colHours = getIdx('hours');
                const colReason = getIdx('reason');
                const colWeather = getIdx('weather');
                const colWinds = getIdx('winds');
                const colOat = getIdx('oat');
                const colRisk = getIdx('risk');
                const colRiskReason = getIdx('risk'); // Reason for elevated risk usually next to risk level?
                // Actually let's just look for "reason for risk"
                const colRiskReasonExplicit = headers.findIndex(h => h.includes('risk') && h.includes('reason'));
                const colNotes = getIdx('notes');
                const colPayload1 = getIdx('payload 1');
                const colPayload2 = getIdx('payload 2');
                const colPayload3 = getIdx('payload 3');

                const mapped = rows.map((row, i) => {
                    // Skip empty rows
                    if (!row[colDate] && !row[colMission]) return null;

                    // Helper for Excel Date/Time
                    const parseDate = (val) => {
                        if (!val) return '';
                        if (typeof val === 'number') {
                            // Excel serial date
                            const date = new Date((val - 25569) * 86400 * 1000);
                            return date.toISOString().split('T')[0];
                        }
                        return val; // Assume string YYYY-MM-DD
                    };

                    const parseTime = (val) => {
                        if (val == null) return '';
                        if (typeof val === 'number') {
                            // Fraction of day
                            const totalSeconds = Math.round(val * 86400);
                            const hours = Math.floor(totalSeconds / 3600);
                            const minutes = Math.floor((totalSeconds % 3600) / 60);
                            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                        }
                        return String(val).trim();
                    };

                    return {
                        id: `import-${i}`,
                        date: parseDate(row[colDate]),
                        status: row[colStatus] || 'Complete',
                        missionNumber: row[colMission] || '',
                        aircraftNumber: row[colAircraft] || '',
                        scheduledLaunchTime: parseTime(row[colSched]),
                        launchTime: parseTime(row[colLaunch]),
                        recoveryTime: parseTime(row[colRecovery]),
                        hours: row[colHours] ? Number(row[colHours]) : 0,
                        reasonForDelay: row[colReason] || '',
                        weather: row[colWeather] || '',
                        winds: row[colWinds] || '',
                        oat: row[colOat] || '',
                        riskLevel: row[colRisk] || 'Low',
                        reasonForRisk: colRiskReasonExplicit !== -1 ? row[colRiskReasonExplicit] : '',
                        notes: row[colNotes] || '',
                        payload1: row[colPayload1] || '',
                        payload2: row[colPayload2] || '',
                        payload3: row[colPayload3] || '',
                    };
                }).filter(Boolean);

                if (mapped.length === 0) {
                    alert('No valid flight records found. Checked ' + rows.length + ' rows.');
                    return;
                }

                setParsedFlights(mapped);
                setImportModalOpen(true);

                // Auto-set deployment if only one selected
                if (selectedDeploymentIds.length === 1) {
                    setTargetDeploymentId(selectedDeploymentIds[0]);
                }
            } catch (error) {
                console.error("Parse Error", error);
                alert('Error parsing file: ' + error.message);
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
            const flightsToAdd = parsedFlights.map(f => {
                const { id, ...data } = f; // Remove temp ID
                return {
                    ...data,
                    deploymentId: parseInt(targetDeploymentId),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            });

            await Promise.all(flightsToAdd.map(f => addFlight(f)));

            setImportModalOpen(false);
            setParsedFlights([]);
            setFileToImport(null);
            loadFlights();
        } catch (error) {
            console.error(error);
            alert('Failed to save imported flights.');
        } finally {
            setImporting(false);
        }
    };

    const handleDeleteFlight = async (id) => {
        if (!canEdit) return;
        if (!confirm('Are you sure you want to delete this flight?')) return;

        try {
            await deleteFlight(id);
            await loadFlights();
        } catch (error) {
            console.error('Error deleting flight:', error);
            alert('Failed to delete flight');
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            status: '',
            startDate: '',
            endDate: ''
        });
        setSearchTerm('');
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Complete': return 'badge-success';
            case 'CNX': return 'badge-error';
            case 'Delay': return 'badge-warning';
            case 'Alert':
            case 'Alert - No Launch': return 'badge-info';
            default: return 'badge-info';
        }
    };

    const getRiskBadgeClass = (risk) => {
        switch (risk) {
            case 'Low': return 'badge-success';
            case 'Med': return 'badge-warning';
            case 'High': return 'badge-error';
            default: return 'badge-info';
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    const getResponsiblePartyText = (flight) => {
        if (flight.status === 'Complete') return 'N/A';

        let party = flight.responsibleParty;
        if (!party && flight.reasonForDelay) {
            party = getResponsibleParty(flight.reasonForDelay);
        }
        return party || '-';
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Flights</h1>
                <p className="page-description">
                    Manage flight operations and situation reports
                </p>

                <div className="page-actions">
                    {canEdit && (
                        <button className="btn btn-primary" onClick={handleAddFlight}>
                            <Plus size={18} />
                            Add Flight
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={18} />
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>
                    <button className="btn btn-secondary">
                        <Download size={18} />
                        Export
                    </button>
                    {canEdit && (
                        <>
                            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                <Upload size={18} />
                                Import
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".xlsx, .xls"
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="card-body">
                    <div style={{ position: 'relative' }}>
                        <Search
                            size={20}
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--color-text-muted)'
                            }}
                        />
                        <input
                            type="text"
                            className="input"
                            placeholder="Search flights by aircraft #, mission #, reason, or notes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '40px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div className="card-header">
                        <h3 className="card-title">Filters</h3>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-cols-4" style={{ gap: 'var(--spacing-md)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Status</label>
                                <select
                                    name="status"
                                    className="select"
                                    value={filters.status}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Complete">Complete</option>
                                    <option value="CNX">CNX</option>
                                    <option value="Delay">Delay</option>
                                    <option value="Alert - No Launch">Alert - No Launch</option>
                                </select>
                            </div>



                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Start Date</label>
                                <input
                                    type="date"
                                    name="startDate"
                                    className="input"
                                    value={filters.startDate}
                                    onChange={handleFilterChange}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">End Date</label>
                                <input
                                    type="date"
                                    name="endDate"
                                    className="input"
                                    value={filters.endDate}
                                    onChange={handleFilterChange}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Summary */}
            <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-muted)' }}>
                Showing {filteredFlights.length} of {flights.length} flights
                {selectedDeploymentIds && selectedDeploymentIds.length > 0 && (
                    <span className="badge badge-info" style={{ marginLeft: '10px' }}>
                        Filtered by Deployment ({selectedDeploymentIds.length})
                    </span>
                )}
            </div>

            {/* Flights Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Mission #</th>
                                <th>Aircraft #</th>
                                <th>Scheduled</th>
                                <th>Launch</th>
                                <th>Recovery</th>
                                <th>Hours</th>
                                <th>Resp. Party</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFlights.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                        <p className="text-muted">
                                            {flights.length === 0
                                                ? 'No flights recorded yet.'
                                                : 'No flights match your search criteria.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredFlights.map((flight) => (
                                    <tr key={flight.id}>
                                        <td>{format(new Date(flight.date), 'MMM dd, yyyy')}</td>
                                        <td className="font-mono font-semibold">{flight.missionNumber}</td>
                                        <td className="font-mono font-semibold">{flight.aircraftNumber}</td>
                                        <td>{flight.scheduledLaunchTime || '-'}</td>
                                        <td>{flight.launchTime || '-'}</td>
                                        <td>{flight.recoveryTime || '-'}</td>
                                        <td>{flight.hours?.toFixed(1) || '0.0'}</td>

                                        <td>
                                            {(() => {
                                                const party = getResponsiblePartyText(flight);
                                                const isShieldAI = party === 'Shield AI';
                                                return (
                                                    <span style={{
                                                        color: isShieldAI ? 'var(--color-error)' : 'inherit',
                                                        fontWeight: isShieldAI ? 'bold' : 'normal'
                                                    }}>
                                                        {party}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        <td>
                                            <span className={`badge ${getStatusBadgeClass(flight.status)}`}>
                                                {flight.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => handleEditFlight(flight)}
                                                    title={canEdit ? "Edit" : "View"}
                                                >
                                                    {canEdit ? <Edit size={16} /> : <Eye size={16} />}
                                                </button>
                                                {canEdit && (
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDeleteFlight(flight.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingFlight(null);
                }}
                title={editingFlight ? (canEdit ? 'Edit Flight' : 'View Flight') : 'Add New Flight'}
                size="lg"
            >
                <FlightForm
                    flight={editingFlight}
                    onSave={handleSaveFlight}
                    onCancel={() => {
                        setShowModal(false);
                        setEditingFlight(null);
                    }}
                />
            </Modal>

            {/* Import Preview Modal */}
            <Modal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                title="Import Flights"
                size="lg"
            >
                <div className="space-y-4">
                    <div className="bg-bg-tertiary p-3 rounded flex justify-between items-center">
                        <div>
                            <span className="font-bold block">{fileToImport?.name}</span>
                            <span className="text-sm text-muted">{parsedFlights.length} flights found</span>
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
                                    <th>Mission</th>
                                    <th>Aircraft</th>
                                    <th>Status</th>
                                    <th>Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedFlights.map((f, i) => (
                                    <tr key={i} className="hover:bg-bg-secondary">
                                        <td>{f.date}</td>
                                        <td>{f.missionNumber}</td>
                                        <td>{f.aircraftNumber}</td>
                                        <td>
                                            <span className={`badge badge-sm ${getStatusBadgeClass(f.status)}`}>{f.status}</span>
                                        </td>
                                        <td>{f.hours}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="modal-footer flex start-0">
                        {/* Spacer */}
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

export default Flights;
