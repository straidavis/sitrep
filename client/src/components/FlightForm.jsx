import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { getAllFlights } from '../db/flights';
import { getAllEquipment } from '../db/equipment';
import { getAllDeployments } from '../db/deployments';
import { useDeployment } from '../context/DeploymentContext';
import { useAuth } from '../context/AuthContext';

import { CANCELLATION_CRITERIA, getResponsibleParty } from '../utils/constants';

const FlightForm = ({ flight, onSave, onCancel }) => {
    // Get global context for auto-fill logic
    const { selectedDeploymentIds } = useDeployment();
    const { canEdit } = useAuth();

    const [formData, setFormData] = useState({
        date: '',
        status: 'Complete',
        missionNumber: '',
        aircraftNumber: '',

        launcher: '',
        numberOfLaunches: 1,
        deploymentId: '',
        scheduledLaunchTime: '',
        launchTime: '',
        recoveryTime: '',
        hours: '',
        payload1: '',
        payload2: '',
        payload3: '',
        reasonForDelay: '',
        responsibleParty: '', // Added field
        windsLaunch: '',
        windsRecovery: '',
        tois: '',
        notes: ''
    });

    const [errors, setErrors] = useState({});
    const [warnings, setWarnings] = useState({});
    const [aircraftList, setAircraftList] = useState([]);
    const [launcherList, setLauncherList] = useState([]);
    const [payloadList, setPayloadList] = useState([]);
    const [deployments, setDeployments] = useState([]);

    const statuses = ['Complete', 'CNX', 'Delay', 'Alert - No Launch'];

    useEffect(() => {
        loadEquipment();
        loadDeployments();
    }, []);

    useEffect(() => {
        if (flight) {
            setFormData({
                date: flight.date?.split('T')[0] || '',
                status: flight.status || 'Complete',
                missionNumber: flight.missionNumber || '',
                aircraftNumber: flight.aircraftNumber || '',

                launcher: flight.launcher || '',
                numberOfLaunches: flight.numberOfLaunches || 1,
                deploymentId: flight.deploymentId || '',
                scheduledLaunchTime: flight.scheduledLaunchTime || '',
                launchTime: flight.launchTime || '',
                recoveryTime: flight.recoveryTime || '',
                hours: flight.hours || '',
                payload1: flight.payload1 || '',
                payload2: flight.payload2 || '',
                payload3: flight.payload3 || '',
                reasonForDelay: flight.reasonForDelay || '',
                responsibleParty: flight.responsibleParty || '',
                windsLaunch: flight.windsLaunch || '', // New field
                windsRecovery: flight.windsRecovery || flight.winds || '', // Renamed field, default to old winds if valid
                tois: flight.tois || '',
                notes: flight.notes || ''
            });
        } else {
            // Auto-fill deployment if only one is selected globally
            if (selectedDeploymentIds && selectedDeploymentIds.length === 1) {
                setFormData(prev => ({ ...prev, deploymentId: selectedDeploymentIds[0] }));
            }
        }
    }, [flight, selectedDeploymentIds]);

    // Check for inactive deployment
    useEffect(() => {
        if (formData.deploymentId) {
            const dep = deployments.find(d => d.id === parseInt(formData.deploymentId));
            if (dep && ['Planning', 'Completed', 'Cancelled'].includes(dep.status)) {
                setWarnings(prev => ({ ...prev, deployment: `Warning: Selected deployment is ${dep.status}.` }));
            } else {
                setWarnings(prev => {
                    const newWarnings = { ...prev };
                    delete newWarnings.deployment;
                    return newWarnings;
                });
            }
        }
    }, [formData.deploymentId, deployments]);

    // Validate Winds format on change
    useEffect(() => {
        // Format: upto 3 digits, @, upto 3 digits. e.g. 120@15
        const windsRegex = /^\d{1,3}@\d{1,3}$/;

        setWarnings(prev => {
            const next = { ...prev };

            // Validate Launch Winds
            if (formData.windsLaunch && !windsRegex.test(formData.windsLaunch)) {
                next.windsLaunch = 'Launch: Format 120@15';
            } else {
                delete next.windsLaunch;
            }

            // Validate Recovery Winds
            if (formData.windsRecovery && !windsRegex.test(formData.windsRecovery)) {
                next.windsRecovery = 'Recovery: Format 120@15';
            } else {
                delete next.windsRecovery;
            }

            return next;
        });
    }, [formData.windsLaunch, formData.windsRecovery]);

    // Auto-generate mission number: YYYYMMDD_##
    useEffect(() => {
        const generateMissionNumber = async () => {
            if (formData.date && !flight) {
                // Avoid timezone issues by parsing string directly (YYYY-MM-DD)
                const [year, month, day] = formData.date.split('-');
                const yy = year.slice(-2);

                let prefix = `${yy}${month}${day}`;

                // If Complete or Delayed, append Aircraft Serial to prefix
                if (['Complete', 'Delay'].includes(formData.status) && formData.aircraftNumber) {
                    prefix = `${prefix}_${formData.aircraftNumber}`;
                }

                try {
                    // Fetch all flights to find duplicates for this day
                    const allFlights = await getAllFlights({ startDate: formData.date, endDate: formData.date });

                    // Filter flights that match the prefix
                    // This logic assumes we rely on DB for uniqueness. 
                    // If multiple users are adding, conflicts might occur on save, but this gives a good starting point.
                    // We look for any existing mission number starting with prefix
                    const existingSuffixes = allFlights
                        .map(f => f.missionNumber)
                        .filter(num => num && num.startsWith(prefix + '_'))
                        .map(num => {
                            const parts = num.split('_');
                            return parseInt(parts[parts.length - 1]); // Last part is the counter
                        })
                        .filter(n => !isNaN(n));

                    let nextSuffix = 0;
                    if (existingSuffixes.length > 0) {
                        nextSuffix = Math.max(...existingSuffixes) + 1;
                    }

                    const suffixStr = String(nextSuffix).padStart(2, '0');
                    const missionNum = `${prefix}_${suffixStr}`;

                    // Only update if it changed to avoid loops, though check dependency is date
                    setFormData(prev => ({ ...prev, missionNumber: missionNum }));

                } catch (error) {
                    console.error("Error generating mission number", error);
                }
            }
        };

        generateMissionNumber();
    }, [formData.date, formData.status, formData.aircraftNumber, flight]);

    // Auto-calculate hours when launch and recovery times change
    useEffect(() => {
        if (formData.launchTime && formData.recoveryTime) {
            const launch = new Date(`2000-01-01T${formData.launchTime}`);
            const recovery = new Date(`2000-01-01T${formData.recoveryTime}`);
            let diff = (recovery - launch) / (1000 * 60 * 60); // hours

            // Handle overnight flights
            if (diff < 0) {
                diff += 24;
            }

            setFormData(prev => ({ ...prev, hours: diff.toFixed(1) }));
        }
    }, [formData.launchTime, formData.recoveryTime]);

    // Handling Reason Change to Auto-Fill Responsible Party
    const handleReasonChange = (e) => {
        const reason = e.target.value;
        const responsible = getResponsibleParty(reason);
        setFormData(prev => ({ ...prev, reasonForDelay: reason, responsibleParty: responsible }));
    };

    const loadEquipment = async () => {
        try {
            const allEquipment = await getAllEquipment();

            // Function to get distinct equipment by serial number with latest status
            // Filter also for status == 'FMC' or 'PMC'
            const getLatestDistinct = (items) => {
                const map = new Map();
                items.forEach(item => {
                    if (!item.serialNumber) return;

                    // Assuming items are not guaranteed sorted, but typically later ID/updates win.
                    // Ideally we sort by date descending if 'date' field exists and is reliable.
                    // Let's assume the array order is rough chronological order or database ID order.
                    // We'll just overwrite map entry, so last one wins.
                    map.set(item.serialNumber, item);
                });

                // Convert map values to array and filter by status
                return Array.from(map.values())
                    .filter(item => ['FMC', 'PMC'].includes(item.status))
                    .map(item => ({
                        serial: item.serialNumber,
                        label: `${item.equipment} - ${item.serialNumber} (${item.status})`
                    }));
            };

            // Filter aircraft (Aircraft category)
            const aircraft = getLatestDistinct(allEquipment.filter(item => item.category === 'Aircraft'));
            setAircraftList(aircraft);

            // Filter launchers (Launchers category)
            const launchers = getLatestDistinct(allEquipment.filter(item => item.category === 'Launchers'));
            setLauncherList(launchers);

            // Filter payloads (Payloads category)
            const payloads = getLatestDistinct(allEquipment.filter(item => item.category === 'Payloads'));
            setPayloadList(payloads);
        } catch (error) {
            console.error('Error loading equipment:', error);
        }
    };

    const loadDeployments = async () => {
        try {
            const data = await getAllDeployments();
            setDeployments(data);
        } catch (error) {
            console.error('Error loading deployments:', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };

            // Clear fields if Alert - No Launch or CNX
            if (name === 'status' && (value === 'Alert - No Launch' || value === 'CNX')) {
                next.launchTime = '';
                next.recoveryTime = '';
                next.hours = '0.0';
                next.aircraftNumber = '';
                next.launcher = '';
                next.numberOfLaunches = 1;
                next.payload1 = '';
                next.payload2 = '';
                next.payload3 = '';
                next.windsLaunch = '';
                next.windsRecovery = '';
                next.tois = '';
            }

            return next;
        });
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.date) newErrors.date = 'Date is required';
        if (!formData.deploymentId) newErrors.deploymentId = 'Deployment is required';

        // Conditional Validation: Aircraft, Payload, TOIs are NOT required for CNX or Alert
        const isNotFlown = ['CNX', 'Alert - No Launch'].includes(formData.status);

        if (!isNotFlown) {
            if (!formData.aircraftNumber) newErrors.aircraftNumber = 'Aircraft number is required';
            if (!formData.payload1) newErrors.payload1 = 'Primary Payload is required';
            if (formData.tois === '' || formData.tois === null || formData.tois === undefined) {
                newErrors.tois = 'TOIs count is required';
            }
        }

        // Require Reason if CNX or Delay
        if (['CNX', 'Delay'].includes(formData.status)) {
            if (!formData.reasonForDelay) {
                newErrors.reasonForDelay = 'Reason is required';
            }
        }

        // Require Times if Status is Complete
        if (formData.status === 'Complete') {
            if (!formData.scheduledLaunchTime) newErrors.scheduledLaunchTime = 'Required';
            if (!formData.launchTime) newErrors.launchTime = 'Required';
            if (!formData.recoveryTime) newErrors.recoveryTime = 'Required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validate()) return;

        const flightData = {
            date: new Date(formData.date).toISOString(),
            status: formData.status,
            missionNumber: formData.missionNumber,
            aircraftNumber: formData.aircraftNumber,

            launcher: formData.launcher,
            numberOfLaunches: parseInt(formData.numberOfLaunches) || 1,
            deploymentId: parseInt(formData.deploymentId),
            scheduledLaunchTime: formData.scheduledLaunchTime,
            launchTime: formData.launchTime,
            recoveryTime: formData.recoveryTime,
            hours: parseFloat(formData.hours) || 0,
            payload1: formData.payload1,
            payload2: formData.payload2,
            payload3: formData.payload3,
            reasonForDelay: formData.reasonForDelay,
            responsibleParty: formData.responsibleParty, // Save this!
            windsLaunch: formData.windsLaunch,
            windsRecovery: formData.windsRecovery,
            tois: parseInt(formData.tois) || 0,
            notes: formData.notes
        };

        onSave(flightData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-3" style={{ gap: 'var(--spacing-lg)' }}>
                {/* Date */}
                <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                        type="date"
                        name="date"
                        className="input"
                        value={formData.date}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.date && <span className="form-error">{errors.date}</span>}
                </div>

                {/* Status */}
                <div className="form-group">
                    <label className="form-label">Status *</label>
                    <select
                        name="status"
                        className="select"
                        value={formData.status}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        {statuses.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>

                {/* Mission Number (Auto-generated) */}
                <div className="form-group">
                    <label className="form-label">Mission # (Auto-generated)</label>
                    <input
                        type="text"
                        name="missionNumber"
                        className="input"
                        value={formData.missionNumber}
                        readOnly
                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                        disabled={!canEdit}
                    />
                </div>

                {/* Aircraft Number */}
                <div className="form-group">
                    <label className="form-label">Aircraft # {(!['CNX', 'Alert - No Launch'].includes(formData.status)) && '*'}</label>
                    <select
                        name="aircraftNumber"
                        className="select"
                        value={formData.aircraftNumber}
                        onChange={handleChange}
                        disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                    >
                        <option value="">Select Aircraft S/N</option>
                        {aircraftList.map(item => (
                            <option key={item.serial} value={item.serial}>{item.label}</option>
                        ))}
                    </select>
                    {errors.aircraftNumber && <span className="form-error">{errors.aircraftNumber}</span>}
                </div>

                {/* Launcher */}
                <div className="form-group">
                    <label className="form-label">Launcher</label>
                    <select
                        name="launcher"
                        className="select"
                        value={formData.launcher}
                        onChange={handleChange}
                        disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                    >
                        <option value="">Select Launcher S/N</option>
                        {launcherList.map(item => (
                            <option key={item.serial} value={item.serial}>{item.label}</option>
                        ))}
                    </select>
                </div>

                {/* Number of Launches */}
                <div className="form-group">
                    <label className="form-label"># of Launches</label>
                    <select
                        name="numberOfLaunches"
                        className="select"
                        value={formData.numberOfLaunches}
                        onChange={handleChange}
                        disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>

                {/* Deployment */}
                <div className="form-group">
                    <label className="form-label">Deployment *</label>
                    <select
                        name="deploymentId"
                        className={errors.deploymentId ? 'select border-error' : 'select'}
                        value={formData.deploymentId}
                        onChange={handleChange}
                        disabled={!canEdit}
                    >
                        <option value="">Select Deployment</option>
                        {deployments.map(deployment => (
                            <option key={deployment.id} value={deployment.id}>
                                {deployment.name} - {deployment.location} ({deployment.status})
                            </option>
                        ))}
                    </select>
                    {errors.deploymentId && <span className="form-error">{errors.deploymentId}</span>}
                    {warnings.deployment && (
                        <span className="form-error text-warning" style={{ color: 'var(--color-warning)' }}>
                            {warnings.deployment}
                        </span>
                    )}
                </div>

                {/* Scheduled Launch Time */}
                <div className="form-group">
                    <label className="form-label">Scheduled Launch {(formData.status === 'Complete') && '*'}</label>
                    <input
                        type="time"
                        name="scheduledLaunchTime"
                        className="input"
                        value={formData.scheduledLaunchTime}
                        onChange={handleChange}
                        disabled={!canEdit}
                    />
                    {errors.scheduledLaunchTime && <span className="form-error">{errors.scheduledLaunchTime}</span>}
                </div>

                {/* Launch Time */}
                {/* Launch Time */}
                <div className="form-group">
                    <label className="form-label">Launch Time {(formData.status === 'Complete') && '*'}</label>
                    <input
                        type={['Alert - No Launch', 'CNX'].includes(formData.status) ? "text" : "time"}
                        name="launchTime"
                        className="input"
                        value={['Alert - No Launch', 'CNX'].includes(formData.status) ? "N/A" : formData.launchTime}
                        onChange={handleChange}
                        disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                    />
                    {errors.launchTime && <span className="form-error">{errors.launchTime}</span>}
                </div>

                {/* Recovery Time */}
                <div className="form-group">
                    <label className="form-label">Recovery Time {(formData.status === 'Complete') && '*'}</label>
                    <input
                        type={['Alert - No Launch', 'CNX'].includes(formData.status) ? "text" : "time"}
                        name="recoveryTime"
                        className="input"
                        value={['Alert - No Launch', 'CNX'].includes(formData.status) ? "N/A" : formData.recoveryTime}
                        onChange={handleChange}
                        disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                    />
                    {errors.recoveryTime && <span className="form-error">{errors.recoveryTime}</span>}
                </div>

                {/* Hours (Auto-calculated) */}
                <div className="form-group">
                    <label className="form-label">Hours (Auto-calculated)</label>
                    <input
                        type="number"
                        name="hours"
                        className="input"
                        value={formData.hours}
                        readOnly
                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                        step="0.1"
                        disabled={!canEdit}
                    />
                </div>


            </div>

            {/* Payloads Section */}
            <div style={{
                marginTop: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-lg)',
                padding: 'var(--spacing-lg)',
                backgroundColor: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)'
            }}>
                <h4 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
                    Payloads
                </h4>
                <div className="grid grid-cols-3" style={{ gap: 'var(--spacing-md)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Payload 1 {(!['CNX', 'Alert - No Launch'].includes(formData.status)) && '*'}</label>
                        <select
                            name="payload1"
                            className="select"
                            value={formData.payload1}
                            onChange={handleChange}
                            disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                        >
                            <option value="">Select Payload S/N</option>
                            {payloadList.map(item => (
                                <option key={item.serial} value={item.serial}>{item.label}</option>
                            ))}
                        </select>
                        {errors.payload1 && <span className="form-error">{errors.payload1}</span>}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Payload 2</label>
                        <select
                            name="payload2"
                            className="select"
                            value={formData.payload2}
                            onChange={handleChange}
                            disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                        >
                            <option value="">Select Payload S/N</option>
                            {payloadList.map(item => (
                                <option key={item.serial} value={item.serial}>{item.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Payload 3</label>
                        <select
                            name="payload3"
                            className="select"
                            value={formData.payload3}
                            onChange={handleChange}
                            disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                        >
                            <option value="">Select Payload S/N</option>
                            {payloadList.map(item => (
                                <option key={item.serial} value={item.serial}>{item.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Reason for Cancel, Abort or Delay */}
            <div className="grid grid-cols-2" style={{ gap: 'var(--spacing-lg)' }}>
                <div className="form-group">
                    <label className="form-label">REASON for Cancel, Abort or Delay {(['CNX', 'Delay'].includes(formData.status)) && '*'}</label>
                    <select
                        name="reasonForDelay"
                        className="select"
                        value={formData.reasonForDelay}
                        onChange={handleReasonChange}
                        disabled={!canEdit}
                    >
                        <option value="">Select Reason...</option>
                        {CANCELLATION_CRITERIA.map((item, idx) => (
                            <option key={idx} value={item.label}>{item.label}</option>
                        ))}
                    </select>
                    {errors.reasonForDelay && <span className="form-error">{errors.reasonForDelay}</span>}
                </div>
                <div className="form-group">
                    <label className="form-label">Responsible Party</label>
                    <input
                        type="text"
                        className="input"
                        value={formData.responsibleParty || ''}
                        readOnly
                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                    />
                </div>
            </div>

            {/* Winds Section */}
            <div className="grid grid-cols-2" style={{ gap: 'var(--spacing-lg)' }}>
                <div className="form-group">
                    <label className="form-label">Winds at launch</label>
                    <input
                        type="text"
                        name="windsLaunch"
                        className="input"
                        placeholder="e.g., 120@15"
                        value={formData.windsLaunch}
                        onChange={handleChange}
                        disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                    />
                    {warnings.windsLaunch && (
                        <span className="form-error text-warning" style={{ color: 'var(--color-warning)' }}>
                            {warnings.windsLaunch}
                        </span>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">Winds at recovery</label>
                    <input
                        type="text"
                        name="windsRecovery"
                        className="input"
                        placeholder="e.g., 120@15"
                        value={formData.windsRecovery}
                        onChange={handleChange}
                        disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                    />
                    {warnings.windsRecovery && (
                        <span className="form-error text-warning" style={{ color: 'var(--color-warning)' }}>
                            {warnings.windsRecovery}
                        </span>
                    )}
                </div>
            </div>



            {/* TOIs */}
            <div className="form-group">
                <label className="form-label">TOIs {(!['CNX', 'Alert - No Launch'].includes(formData.status)) && '*'}</label>
                <input
                    type="number"
                    name="tois"
                    className="input"
                    placeholder="Enter number of TOIs"
                    value={formData.tois}
                    onChange={handleChange}
                    disabled={!canEdit || ['Alert - No Launch', 'CNX'].includes(formData.status)}
                />
                {errors.tois && <span className="form-error">{errors.tois}</span>}
            </div>

            {/* Notes */}
            <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                    name="notes"
                    className="textarea"
                    placeholder="Additional notes or comments"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    disabled={!canEdit}
                />
            </div>

            {/* Form Actions */}
            <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    <X size={18} />
                    Close
                </button>
                {canEdit && (
                    <button type="submit" className="btn btn-primary">
                        <Save size={18} />
                        {flight ? 'Update Flight' : 'Add Flight'}
                    </button>
                )}
                {!canEdit && (
                    <span className="text-muted text-sm italic ml-4">Read Only Mode</span>
                )}
            </div>
        </form>
    );
};

export default FlightForm;
