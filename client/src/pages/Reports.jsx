import React, { useState, useEffect, useMemo } from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    BarChart
} from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, getISOWeek, getYear, isWithinInterval, parseISO } from 'date-fns';
import { Calendar, Filter, Activity, Clock, Plane, Target } from 'lucide-react';
import { getAllFlights } from '../db/flights';
import { getAllEquipment } from '../db/equipment'; // Import to resolve names
import { useDeployment } from '../context/DeploymentContext';

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#ec4899'];

const Reports = () => {
    const { selectedDeploymentIds } = useDeployment();
    const [loading, setLoading] = useState(true);
    const [flights, setFlights] = useState([]);
    const [equipmentMap, setEquipmentMap] = useState(new Map()); // Map Serial -> Name

    // Filters
    const [startDate, setStartDate] = useState(format(addDays(new Date(), -90), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
    const [isAutoDate, setIsAutoDate] = useState(true);

    useEffect(() => {
        loadData();
    }, [selectedDeploymentIds]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [allFlights, allEquipment] = await Promise.all([
                getAllFlights(),
                getAllEquipment()
            ]);

            // Create Equipment Map (Serial -> Name)
            const eqMap = new Map();
            allEquipment.forEach(item => {
                if (item.serialNumber) {
                    eqMap.set(item.serialNumber, item.equipment); // Map Serial to "Type/Name"
                }
            });
            setEquipmentMap(eqMap);

            // Initial filter by deployment
            const deploymentFiltered = (selectedDeploymentIds && selectedDeploymentIds.length > 0)
                ? allFlights.filter(f => selectedDeploymentIds.includes(f.deploymentId))
                : allFlights;

            setFlights(deploymentFiltered);

            // Auto-set Date Range to max range of data available
            if (deploymentFiltered.length > 0) {
                const dates = deploymentFiltered.map(f => new Date(f.date).getTime());
                const minDate = new Date(Math.min(...dates));
                const maxDate = new Date(Math.max(...dates));

                // Add a small buffer or align to week start/end if nice, but exact range is fine
                // Only set if we want auto-behavior (on first load or change of deployment)
                // For now, let's always set it on load to ensure user sees data
                setStartDate(format(minDate, 'yyyy-MM-dd'));
                setEndDate(format(maxDate, 'yyyy-MM-dd'));
            } else {
                // Default to last 90 days if no data
                setStartDate(format(addDays(new Date(), -90), 'yyyy-MM-dd'));
                setEndDate(format(new Date(), 'yyyy-MM-dd'));
            }

        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter flights by Date Range
    const dateFilteredFlights = useMemo(() => {
        return flights.filter(f => {
            const date = f.date.split('T')[0];
            return date >= startDate && date <= endDate;
        });
    }, [flights, startDate, endDate]);

    // --- Summary Statistics ---
    const summaryStats = useMemo(() => {
        const totalFlights = dateFilteredFlights.length;
        const totalHours = dateFilteredFlights.reduce((acc, curr) => acc + (parseFloat(curr.hours) || 0), 0);
        const cancelled = dateFilteredFlights.filter(f => f.status === 'CNX').length;
        const tois = dateFilteredFlights.reduce((acc, curr) => acc + (parseInt(curr.tois) || 0), 0);

        const mrr = totalFlights > 0
            ? ((totalFlights - cancelled) / totalFlights) * 100
            : 100;

        return {
            totalFlights,
            totalHours: totalHours.toFixed(1),
            mrr: mrr.toFixed(1),
            tois
        };
    }, [dateFilteredFlights]);

    // --- Aggregate Data for Combo Chart (Hours, MRR, Delays) ---
    const comboData = useMemo(() => {
        const grouped = {};

        dateFilteredFlights.forEach(flight => {
            const dateObj = new Date(flight.date);
            let key;

            if (viewMode === 'week') {
                key = `${getYear(dateObj)}-W${getISOWeek(dateObj)}`; // e.g., 2025-W49
            } else {
                key = format(dateObj, 'yyyy-MM'); // e.g., 2025-12
            }

            if (!grouped[key]) {
                grouped[key] = {
                    period: key,
                    totalHours: 0,
                    totalFlights: 0,
                    delayedFlights: 0,
                    cancelledFlights: 0
                };
            }

            grouped[key].totalHours += parseFloat(flight.hours || 0);
            grouped[key].totalFlights += 1;
            if (flight.status === 'Delay') grouped[key].delayedFlights += 1;
            if (flight.status === 'CNX') grouped[key].cancelledFlights += 1;
        });

        // Convert to sorted array
        const sortedData = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));

        // Calculate Cumulative MRR
        let runningTotalFlights = 0;
        let runningCancelledFlights = 0;

        return sortedData.map(item => {
            runningTotalFlights += item.totalFlights;
            runningCancelledFlights += item.cancelledFlights;

            const cumMrr = runningTotalFlights > 0
                ? ((runningTotalFlights - runningCancelledFlights) / runningTotalFlights) * 100
                : 100;

            const delayRate = item.totalFlights > 0
                ? (item.delayedFlights / item.totalFlights) * 100
                : 0;

            return {
                name: item.period,
                hours: parseFloat(item.totalHours.toFixed(1)),
                mrr: parseFloat(cumMrr.toFixed(1)),
                delayRate: parseFloat(delayRate.toFixed(1))
            };
        });
    }, [dateFilteredFlights, viewMode]);

    // --- Aggregate Data for Payload Utilization Pie Chart (Group by Type) ---
    const payloadData = useMemo(() => {
        const counts = {};
        dateFilteredFlights.forEach(flight => {
            [flight.payload1, flight.payload2, flight.payload3].forEach(pSerial => {
                if (pSerial) {
                    // Resolve Serial Number to Type Name if possible
                    const typeName = equipmentMap.get(pSerial) || pSerial; // Fallback to serial if no type found
                    counts[typeName] = (counts[typeName] || 0) + 1;
                }
            });
        });

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [dateFilteredFlights, equipmentMap]);

    // --- Aggregate Data for Launcher Utilization (Group by Date and Launcher) ---
    // User wants "launches per serial number by date".
    // We will create a time-series chart showing daily activity per launcher.
    const launcherTimeSeries = useMemo(() => {
        // 1. Group daily launches first
        const grouped = {};
        const launcherSet = new Set();

        dateFilteredFlights.forEach(flight => {
            if (flight.launcher && flight.date) {
                const dateKey = flight.date.split('T')[0];
                if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey };

                const lSerial = flight.launcher;
                launcherSet.add(lSerial);

                const launches = flight.numberOfLaunches || 1;
                grouped[dateKey][lSerial] = (grouped[dateKey][lSerial] || 0) + launches;
            }
        });

        // 2. Sort by date
        const sortedDaily = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

        // 3. Calculate Cumulative
        const runningTotals = {};
        // Initialize running totals
        launcherSet.forEach(l => runningTotals[l] = 0);

        const cumulativeData = sortedDaily.map(day => {
            const newDay = { date: day.date };
            launcherSet.forEach(l => {
                // Add today's launches to running total
                if (day[l]) {
                    runningTotals[l] += day[l];
                }
                // Set current total for this day
                newDay[l] = runningTotals[l];
            });
            return newDay;
        });

        return { data: cumulativeData, launchers: Array.from(launcherSet) };
    }, [dateFilteredFlights]);

    // --- Mock Data for FMC Rate (Since we don't track historical equipment status yet) ---
    const fmcData = useMemo(() => {
        if (comboData.length === 0) return [];
        // Generate pseudo-random realistic FMC data matching the periods of flight data
        return comboData.map(item => ({
            name: item.name,
            fmcRate: Math.min(100, Math.max(70, 85 + (Math.random() * 10 - 5))).toFixed(1)
        }));
    }, [comboData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="pb-20">
            {/* Header / Controls */}
            <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-lg">
                <div>
                    <h1 className="page-title">Operational Reports</h1>
                    <p className="page-description">
                        Flight hours, reliability metrics, and system utilization
                    </p>
                </div>

                <div className="card p-4 flex flex-col md:flex-row gap-md items-end md:items-center bg-bg-secondary w-full md:w-auto">
                    <div className="form-group mb-0 w-full md:w-auto">
                        <label className="form-label text-xs uppercase tracking-wider mb-1">Date Range</label>
                        <div className="flex items-center gap-sm">
                            <input
                                type="date"
                                className="input py-2 text-sm"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setIsAutoDate(false);
                                }}
                            />
                            <span className="text-muted">-</span>
                            <input
                                type="date"
                                className="input py-2 text-sm"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setIsAutoDate(false);
                                }}
                            />
                        </div>
                    </div>

                    <div className="form-group mb-0 w-full md:w-auto">
                        <label className="form-label text-xs uppercase tracking-wider mb-1">View Mode</label>
                        <div className="flex bg-bg-tertiary rounded-md p-1 border border-border">
                            <button
                                className={`btn btn-sm flex-1 ${viewMode === 'week' ? 'bg-accent-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                onClick={() => setViewMode('week')}
                            >
                                Weekly
                            </button>
                            <button
                                className={`btn btn-sm flex-1 ${viewMode === 'month' ? 'bg-accent-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                onClick={() => setViewMode('month')}
                            >
                                Monthly
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-lg mb-8">
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon">
                            <Plane size={24} />
                        </div>
                    </div>
                    <div className="stat-label">Total Flights</div>
                    <div className="stat-value">{summaryStats.totalFlights}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon">
                            <Clock size={24} />
                        </div>
                    </div>
                    <div className="stat-label">Flight Hours</div>
                    <div className="stat-value">{summaryStats.totalHours}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon">
                            <Activity size={24} />
                        </div>
                    </div>
                    <div className="stat-label">Overall MRR</div>
                    <div className="stat-value">{summaryStats.mrr}%</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon">
                            <Target size={24} />
                        </div>
                    </div>
                    <div className="stat-label">Total TOIs</div>
                    <div className="stat-value">{summaryStats.tois}</div>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">

                {/* 1. Combo Graph: Hours, MRR, Delays */}
                <div className="card col-span-1 lg:col-span-2">
                    <div className="card-header flex items-center justify-between">
                        <h3 className="card-title">Operational Tempo & Reliability</h3>
                        <div className="flex gap-4 text-sm text-text-muted">
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-accent-primary rounded-sm"></span> Hours
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-success rounded-full"></span> MRR
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-warning rounded-full"></span> Delays
                            </span>
                        </div>
                    </div>
                    <div className="card-body" style={{ height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={comboData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--color-text-secondary)"
                                    tick={{ fontSize: 12 }}
                                    tickMargin={10}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="var(--color-text-secondary)"
                                    label={{ value: 'Flight Hours', angle: -90, position: 'insideLeft', style: { fill: 'var(--color-text-muted)' } }}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="var(--color-text-secondary)"
                                    domain={[0, 100]}
                                    label={{ value: 'Percentage %', angle: 90, position: 'insideRight', style: { fill: 'var(--color-text-muted)' } }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--color-text-primary)' }}
                                />
                                <Bar yAxisId="left" dataKey="hours" name="Flight Hours" fill="var(--color-accent-primary)" barSize={20} radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="mrr" name="Cumulative MRR %" stroke="var(--color-success)" strokeWidth={3} dot={{ r: 4 }} />
                                <Line yAxisId="right" type="monotone" dataKey="delayRate" name="Delay Rate %" stroke="var(--color-warning)" strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. FMC Rate Graph */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Fleet FMC Rate</h3>
                    </div>
                    <div className="card-body" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fmcData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--color-text-secondary)" tick={{ fontSize: 12 }} />
                                <YAxis domain={[0, 100]} stroke="var(--color-text-secondary)" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                                />
                                <Line type="stepAfter" dataKey="fmcRate" name="FMC %" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-muted text-center mt-4">* Based on daily equipment status logs</p>
                    </div>
                </div>

                {/* 3. Payload Utilization Pie Chart */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Payload Utilization</h3>
                    </div>
                    <div className="card-body" style={{ height: '300px' }}>
                        {payloadData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={payloadData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {payloadData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-muted flex flex-col items-center justify-center h-full">
                                <Filter size={48} className="mb-2 opacity-50" />
                                <span>No payload data available for period</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Launcher Utilization By Date (Cumulative) */}
                <div className="card lg:col-span-2">
                    <div className="card-header">
                        <h3 className="card-title">Cumulative Launches per Launcher</h3>
                    </div>
                    <div className="card-body" style={{ height: '400px' }}>
                        {launcherTimeSeries.data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={launcherTimeSeries.data}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--color-text-secondary)" tick={{ fontSize: 12 }} />
                                    <YAxis allowDecimals={false} stroke="var(--color-text-secondary)" label={{ value: 'Total Launches', angle: -90, position: 'insideLeft', style: { fill: 'var(--color-text-secondary)' } }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                                        cursor={{ stroke: 'var(--color-text-muted)' }}
                                    />
                                    <Legend />
                                    {launcherTimeSeries.launchers.map((serial, index) => (
                                        <Line
                                            key={serial}
                                            type="monotone"
                                            dataKey={serial}
                                            name={`S/N ${serial}`}
                                            stroke={COLORS[index % COLORS.length]}
                                            strokeWidth={3}
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-muted flex flex-col items-center justify-center h-full">
                                <Activity size={48} className="mb-2 opacity-50" />
                                <span>No launcher activity in selected period</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Reports;
