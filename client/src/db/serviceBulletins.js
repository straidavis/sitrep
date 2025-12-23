/**
 * Database Operations for Service Bulletins
 */

import { db } from './schema';

/**
 * Get all Service Bulletins
 * @returns {Promise<Array>}
 */
export const getAllServiceBulletins = async () => {
    try {
        return await db.serviceBulletins.orderBy('createdAt').reverse().toArray();
    } catch (error) {
        console.error('Error getting Service Bulletins:', error);
        throw error;
    }
};

/**
 * Add new Service Bulletin
 * @param {Object} sbData
 * @param {Object} user - User object for auditing
 * @returns {Promise<number>} - ID of created SB
 */
export const addServiceBulletin = async (sbData, user) => {
    try {
        const now = new Date().toISOString();
        const sb = {
            ...sbData,
            createdAt: now,
            updatedAt: now,
            lastUpdatedBy: user?.name || 'Unknown'
        };

        return await db.serviceBulletins.add(sb);
    } catch (error) {
        console.error('Error adding Service Bulletin:', error);
        throw error;
    }
};

/**
 * Update Service Bulletin
 * @param {number} id
 * @param {Object} updates
 * @param {Object} user - User object for auditing
 * @returns {Promise<number>}
 */
export const updateServiceBulletin = async (id, updates, user) => {
    try {
        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: user?.name || 'Unknown'
        };

        return await db.serviceBulletins.update(id, updatedData);
    } catch (error) {
        console.error('Error updating Service Bulletin:', error);
        throw error;
    }
};

/**
 * Delete Service Bulletin
 * @param {number} id
 * @returns {Promise<void>}
 */
export const deleteServiceBulletin = async (id) => {
    try {
        await db.serviceBulletins.delete(id);
    } catch (error) {
        console.error('Error deleting Service Bulletin:', error);
        throw error;
    }
};
