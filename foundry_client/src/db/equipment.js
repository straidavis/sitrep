/**
 * Database Operations for Equipment
 * Refactored to use FoundrySDKService and Centralized Schema
 */

import { foundrySDKService as foundryService } from '../services/FoundrySDKService';
import { mapFromRaw, mapToRaw } from '../config/schema';

/**
 * Get all equipment
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
export const getAllEquipment = async (filters = {}) => {
    try {
        const rawEquipment = await foundryService.getAllEquipment();

        // Map from Dataset Schema to Application Schema
        let equipment = rawEquipment.map(e => {
            const mapped = mapFromRaw('equipment', e);
            // Fallback ID if not found
            if (!mapped.id) mapped.id = String(e.id || e.serialNumber || Date.now() + Math.random()).trim();
            return mapped;
        });

        // Apply filters
        if (filters.status) equipment = equipment.filter(eq => eq.status === filters.status);
        if (filters.type) equipment = equipment.filter(eq => eq.equipment === filters.type); // 'type' maps to 'equipment' field
        if (filters.location) equipment = equipment.filter(eq => eq.location === filters.location);
        if (filters.category) equipment = equipment.filter(eq => eq.category === filters.category);

        return equipment.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    } catch (error) {
        console.error('Error getting equipment:', error);
        return [];
    }
};

/**
 * Get equipment by ID
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export const getEquipmentById = async (id) => {
    try {
        let equipment = await getAllEquipment();
        return equipment.find(e => String(e.id) === String(id));
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
        const newId = equipmentData.uid || crypto.randomUUID();

        const fullData = {
            ...equipmentData,
            id: newId,
            uid: newId,
            createdAt: now,
            updatedAt: now,
            lastUpdatedBy: user?.name || 'Unknown'
        };

        // Map to Raw (Ontology) Format
        const ontologyObject = mapToRaw('equipment', fullData);

        await foundryService.createObject('equipment', ontologyObject);
        return newId;
    } catch (error) {
        console.error('Error adding equipment:', error);
        throw error;
    }
};

/**
 * Update equipment
 * @param {number|string} id
 * @param {Object} updates
 * @param {Object} user - User object for auditing
 * @returns {Promise<number|string>}
 */
export const updateEquipment = async (id, updates, user) => {
    try {
        const updateData = {
            ...updates,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: user?.name || 'Unknown'
        };

        const ontologyUpdates = mapToRaw('equipment', updateData);

        await foundryService.updateObject('equipment', id, ontologyUpdates);
        return id;
    } catch (error) {
        // Handle 404 (Object Not Found) by attempting to Create (Upsert)
        if (error.message && error.message.includes('404')) {
            console.warn(`[Equipment Update] Update failed (404). Attempting UPSERT (Create) for ID: ${id}...`);
            try {
                // Determine full object data for creation from updates + ID fallback
                // Assuming 'updates' contains enough data or is a full object form
                const createData = {
                    ...updates,
                    id: id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastUpdatedBy: user?.name || 'Unknown'
                };
                const ontologyObject = mapToRaw('equipment', createData);

                await foundryService.createObject('equipment', ontologyObject);
                console.log(`[Equipment Update] UPSERT Successful for ID: ${id}`);
                return id;
            } catch (createError) {
                console.error('[Equipment Update] Upsert (Create) failed:', createError);
                throw createError;
            }
        }

        console.error('Error updating equipment:', error);
        throw error;
    }
};

/**
 * Delete equipment
 * @param {number|string} id
 * @returns {Promise<void>}
 */
export const deleteEquipment = async (id) => {
    try {
        await foundryService.deleteObject('equipment', id);
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
        const mappedList = equipmentList.map(eq => {
            const data = {
                ...eq,
                id: eq.id || Date.now() + Math.random(),
                createdAt: now,
                updatedAt: now,
                // lastUpdatedBy defaults?
            };
            return mapToRaw('equipment', data);
        });

        const current = await foundryService.readDataset('equipment');
        const updated = [...current, ...mappedList];
        await foundryService.writeDataset('equipment', updated);

        return mappedList.length;
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
        const equipment = await getAllEquipment();

        return equipment.filter(eq =>
            (eq.equipment || '').toLowerCase().includes(term) ||
            (eq.serialNumber || '').toLowerCase().includes(term) ||
            (eq.comments || '').toLowerCase().includes(term) ||
            (eq.location || '').toLowerCase().includes(term)
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
            const ids = Array.isArray(deploymentIds)
                ? deploymentIds.map(id => String(id).trim())
                : [String(deploymentIds).trim()];

            if (ids.length > 0) {
                equipment = equipment.filter(eq => ids.includes(String(eq.deploymentId).trim()));
            }
        }

        const totalEquipment = equipment.length;
        const byStatus = equipment.reduce((acc, eq) => {
            const s = eq.status || 'Unknown';
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        }, {});

        const byType = equipment.reduce((acc, eq) => {
            const t = eq.equipment || 'Unknown';
            acc[t] = (acc[t] || 0) + 1;
            return acc;
        }, {});

        const byLocation = equipment.reduce((acc, eq) => {
            const l = eq.location || 'Unknown';
            acc[l] = (acc[l] || 0) + 1;
            return acc;
        }, {});

        // Calculate maintenance due (Mock logic as field might be missing)
        const now = new Date();
        const maintenanceDue = equipment.filter(eq => {
            // Future: Add nextMaintenance to schema if available
            return false;
        }).length;

        // Simplify availability rating (FMC count / Total)
        const avail = byStatus['FMC'] || 0;
        const availabilityRating = totalEquipment > 0 ? (avail / totalEquipment) * 100 : 0;

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
