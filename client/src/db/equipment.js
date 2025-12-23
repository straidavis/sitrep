/**
 * Database Operations for Equipment
 */

import { db } from './schema';
import { api } from '../services/api';
import { config } from '../config';
import { getDeploymentById } from './deployments';

const useRemote = () => config.authMode === 'microsoft';

/**
 * Get all equipment
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
export const getAllEquipment = async (filters = {}) => {
    try {
        if (useRemote()) {
            let equipment = await api.get('v1/equipment');
            // Apply filters client-side to match Dexie behavior for now
            // (Ideally API supports these query params)
            if (filters.status) equipment = equipment.filter(eq => eq.status === filters.status);
            if (filters.type) equipment = equipment.filter(eq => eq.type === filters.type);
            if (filters.location) equipment = equipment.filter(eq => eq.location === filters.location);

            // Sort (simulating .reverse().sortBy('updatedAt'))
            return equipment.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }

        let query = db.equipment.toCollection();

        // Apply filters
        if (filters.status) {
            query = query.filter(eq => eq.status === filters.status);
        }

        if (filters.type) {
            query = query.filter(eq => eq.type === filters.type);
        }

        if (filters.location) {
            query = query.filter(eq => eq.location === filters.location);
        }

        const equipment = await query.reverse().sortBy('updatedAt');
        return equipment;
    } catch (error) {
        console.error('Error getting equipment:', error);
        throw error;
    }
};

/**
 * Get equipment by ID
 * @param {number} id
 * @returns {Promise<Object>}
 */
export const getEquipmentById = async (id) => {
    try {
        return await db.equipment.get(id);
    } catch (error) {
        console.error('Error getting equipment:', error);
        throw error;
    }
};

/**
 * Add new equipment
 * @param {Object} equipmentData
 * @param {Object} user - User object for auditing
 * @returns {Promise<number>} - ID of created equipment
 */
export const addEquipment = async (equipmentData, user) => {
    try {
        const now = new Date().toISOString();
        const equipment = {
            ...equipmentData,
            createdAt: now,
            updatedAt: now,
            lastUpdatedBy: user?.name || 'Unknown'
        };

        if (useRemote()) {
            const result = await api.post('v1/equipment', equipment);
            return result.id;
        }

        return await db.equipment.add(equipment);
    } catch (error) {
        console.error('Error adding equipment:', error);
        throw error;
    }
};

/**
 * Update equipment
 * @param {number} id
 * @param {Object} updates
 * @param {Object} user - User object for auditing
 * @returns {Promise<number>}
 */
export const updateEquipment = async (id, updates, user) => {
    try {
        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: user?.name || 'Unknown'
        };

        return await db.equipment.update(id, updatedData);
    } catch (error) {
        console.error('Error updating equipment:', error);
        throw error;
    }
};

/**
 * Delete equipment
 * @param {number} id
 * @returns {Promise<void>}
 */
export const deleteEquipment = async (id) => {
    try {
        await db.equipment.delete(id);
    } catch (error) {
        console.error('Error deleting equipment:', error);
        throw error;
    }
};

/**
 * Bulk import equipment
 * @param {Array} equipmentList
 * @returns {Promise<number>} - Number of equipment imported
 */
export const bulkImportEquipment = async (equipmentList) => {
    try {
        const now = new Date().toISOString();
        const equipmentWithTimestamps = equipmentList.map(eq => ({
            ...eq,
            createdAt: now,
            updatedAt: now
        }));

        await db.equipment.bulkAdd(equipmentWithTimestamps);
        return equipmentWithTimestamps.length;
    } catch (error) {
        console.error('Error bulk importing equipment:', error);
        throw error;
    }
};

/**
 * Search equipment
 * @param {string} searchTerm
 * @returns {Promise<Array>}
 */
export const searchEquipment = async (searchTerm) => {
    try {
        const term = searchTerm.toLowerCase();
        const equipment = await db.equipment.toArray();

        return equipment.filter(eq =>
            eq.equipmentId?.toLowerCase().includes(term) ||
            eq.serialNumber?.toLowerCase().includes(term) ||
            eq.type?.toLowerCase().includes(term) ||
            eq.description?.toLowerCase().includes(term) ||
            eq.location?.toLowerCase().includes(term) ||
            eq.assignedTo?.toLowerCase().includes(term)
        );
    } catch (error) {
        console.error('Error searching equipment:', error);
        throw error;
    }
};

/**
 * Get equipment statistics
 * @returns {Promise<Object>}
 */
export const getEquipmentStats = async (deploymentIds = null) => {
    try {
        let equipment = await getAllEquipment({});

        if (deploymentIds) {
            // Handle both single ID (legacy) and array
            const ids = Array.isArray(deploymentIds)
                ? deploymentIds.map(id => parseInt(id))
                : [parseInt(deploymentIds)];

            if (ids.length > 0 && !ids.includes(NaN)) {
                equipment = equipment.filter(eq => ids.includes(eq.deploymentId));
            }
        }

        const totalEquipment = equipment.length;
        const byStatus = equipment.reduce((acc, eq) => {
            acc[eq.status] = (acc[eq.status] || 0) + 1;
            return acc;
        }, {});
        const byType = equipment.reduce((acc, eq) => {
            acc[eq.type] = (acc[eq.type] || 0) + 1;
            return acc;
        }, {});
        const byLocation = equipment.reduce((acc, eq) => {
            acc[eq.location] = (acc[eq.location] || 0) + 1;
            return acc;
        }, {});

        // Calculate maintenance due
        const now = new Date();
        const maintenanceDue = equipment.filter(eq => {
            if (!eq.nextMaintenance) return false;
            const dueDate = new Date(eq.nextMaintenance);
            return dueDate <= now;
        }).length;

        return {
            totalEquipment,
            byStatus,
            byType,
            byLocation,
            maintenanceDue
        };

        // --- Availability Rating Logic (Time-Series Carry Over) ---
        // Range: Deployment Start (or first log) -> Today

        let startDate = null;
        let today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 1. Determine Start Date
        if (deploymentIds) {
            const dIds = Array.isArray(deploymentIds) ? deploymentIds : [deploymentIds];
            if (dIds.length === 1) {
                const dep = await getDeploymentById(parseInt(dIds[0]));
                if (dep && dep.startDate) {
                    startDate = new Date(dep.startDate);
                }
            }
        }
        // Fallback: Use earliest log
        if (!startDate && equipment.length > 0) {
            const dates = equipment.map(e => e.date).sort();
            if (dates.length > 0) startDate = new Date(dates[0]);
        }

        let availabilityRating = 0;

        if (startDate) {
            // Sort logs chronologically
            const sortedLogs = [...equipment].sort((a, b) => new Date(a.date) - new Date(b.date));

            // Group logs by Day
            const logsByDay = {};
            sortedLogs.forEach(log => {
                if (!log.date) return;
                const dKey = log.date.split('T')[0];
                if (!logsByDay[dKey]) logsByDay[dKey] = [];
                logsByDay[dKey].push(log);
            });

            // State Tracking: { KEY: { category, status } }
            // Key must be composite to prevent collisions if serials reused across categories
            const currentFleetState = {};

            // ---------------------------------------------------------
            // BACKFILL STRATEGY: 
            // Pre-seed fleet state with the FIRST known record for each serial.
            // This ensures that if Deployment Start is Day 1, but Log is Day 5, 
            // Days 1-4 count based on that Day 5 status (assuming carried back).
            // ---------------------------------------------------------
            const seenSerials = new Set();
            // Iterate chronologically to find the FIRST occurrence of each serial
            sortedLogs.forEach(log => {
                if (log.serialNumber && !seenSerials.has(log.serialNumber)) {
                    seenSerials.add(log.serialNumber);
                    const key = `${log.category}|${log.equipment}|${log.serialNumber}`;
                    currentFleetState[key] = {
                        category: (log.category || '').toLowerCase().trim(),
                        status: (log.status || '').trim().toUpperCase()
                    };
                }
            });
            // ---------------------------------------------------------

            let availableDays = 0;
            let totalDays = 0;

            const cursor = new Date(startDate);
            let cursorStr = cursor.toISOString().split('T')[0];

            while (cursorStr <= todayStr) {
                totalDays++;

                // Update fleet state with logs from this SPECIFIC day (overwriting the backfill/previous)
                if (logsByDay[cursorStr]) {
                    logsByDay[cursorStr].forEach(log => {
                        if (log.serialNumber) {
                            const key = `${log.category}|${log.equipment}|${log.serialNumber}`;
                            currentFleetState[key] = {
                                category: (log.category || '').toLowerCase().trim(),
                                status: (log.status || '').trim().toUpperCase()
                            };
                        }
                    });
                }

                // Check Criteria
                const fleet = Object.values(currentFleetState);
                const hasCapableAircraft = fleet.some(e =>
                    e.category === 'aircraft' &&
                    (e.status === 'FMC' || e.status === 'PMC')
                );
                const hasCapablePayload = fleet.some(e =>
                    e.category.includes('payload') &&
                    (e.status === 'FMC' || e.status === 'PMC')
                );

                if (hasCapableAircraft && hasCapablePayload) {
                    availableDays++;
                }

                // Next Day
                cursor.setDate(cursor.getDate() + 1);
                cursorStr = cursor.toISOString().split('T')[0];
                if (totalDays > 3650) break; // Sanity cap
            }

            if (totalDays > 0) {
                availabilityRating = (availableDays / totalDays) * 100;
            }
            console.log(`[AvailStats] Days: ${totalDays}, Avail: ${availableDays}, Rating: ${availabilityRating.toFixed(1)}%`);
        }

        return {
            totalEquipment,
            byStatus,
            byType,
            byLocation,
            maintenanceDue,
            availabilityRating
        };
    } catch (error) {
        console.error('Error getting equipment stats:', error);
        throw error;
    }
};

/**
 * Get equipment needing maintenance
 * @param {number} daysAhead - Number of days to look ahead
 * @returns {Promise<Array>}
 */
export const getMaintenanceDue = async (daysAhead = 30) => {
    try {
        const equipment = await db.equipment.toArray();
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        return equipment.filter(eq => {
            if (!eq.nextMaintenance) return false;
            const dueDate = new Date(eq.nextMaintenance);
            return dueDate >= now && dueDate <= futureDate;
        }).sort((a, b) => new Date(a.nextMaintenance) - new Date(b.nextMaintenance));
    } catch (error) {
        console.error('Error getting maintenance due:', error);
        throw error;
    }
};
