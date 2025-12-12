/**
 * Database Operations for Equipment
 */

import { db } from './schema';

/**
 * Get all equipment
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
export const getAllEquipment = async (filters = {}) => {
    try {
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
 * @returns {Promise<number>} - ID of created equipment
 */
export const addEquipment = async (equipmentData) => {
    try {
        const now = new Date().toISOString();
        const equipment = {
            ...equipmentData,
            createdAt: now,
            updatedAt: now
        };

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
 * @returns {Promise<number>}
 */
export const updateEquipment = async (id, updates) => {
    try {
        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString()
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
        let equipment = await db.equipment.toArray();

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
