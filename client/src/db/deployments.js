/**
 * Database Operations for Deployments
 */

import { db } from './schema';

/**
 * Get all deployments
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
export const getAllDeployments = async (filters = {}) => {
    try {
        let query = db.deployments.toCollection();

        // Apply filters
        if (filters.type) {
            query = query.filter(dep => dep.type === filters.type);
        }

        if (filters.status) {
            query = query.filter(dep => dep.status === filters.status);
        }

        if (filters.location) {
            query = query.filter(dep => dep.location === filters.location);
        }

        const deployments = await query.reverse().sortBy('startDate');
        return deployments;
    } catch (error) {
        console.error('Error getting deployments:', error);
        throw error;
    }
};

/**
 * Get deployment by ID
 * @param {number} id
 * @returns {Promise<Object>}
 */
export const getDeploymentById = async (id) => {
    try {
        return await db.deployments.get(id);
    } catch (error) {
        console.error('Error getting deployment:', error);
        throw error;
    }
};

/**
 * Add new deployment
 * @param {Object} deploymentData
 * @returns {Promise<number>} - ID of created deployment
 */
export const addDeployment = async (deploymentData) => {
    try {
        const now = new Date().toISOString();
        const deployment = {
            ...deploymentData,
            createdAt: now,
            updatedAt: now
        };

        return await db.deployments.add(deployment);
    } catch (error) {
        console.error('Error adding deployment:', error);
        throw error;
    }
};

/**
 * Update deployment
 * @param {number} id
 * @param {Object} updates
 * @returns {Promise<number>}
 */
export const updateDeployment = async (id, updates) => {
    try {
        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };

        return await db.deployments.update(id, updatedData);
    } catch (error) {
        console.error('Error updating deployment:', error);
        throw error;
    }
};

/**
 * Delete deployment
 * @param {number} id
 * @returns {Promise<void>}
 */
export const deleteDeployment = async (id) => {
    try {
        await db.deployments.delete(id);
    } catch (error) {
        console.error('Error deleting deployment:', error);
        throw error;
    }
};

/**
 * Get active deployments
 * @returns {Promise<Array>}
 */
export const getActiveDeployments = async () => {
    try {
        const now = new Date().toISOString();
        const deployments = await db.deployments.toArray();

        return deployments.filter(dep =>
            dep.startDate <= now && dep.endDate >= now && dep.status === 'Active'
        );
    } catch (error) {
        console.error('Error getting active deployments:', error);
        throw error;
    }
};

/**
 * Get deployment statistics
 * @returns {Promise<Object>}
 */
export const getDeploymentStats = async () => {
    try {
        const deployments = await db.deployments.toArray();
        const now = new Date().toISOString();

        const totalDeployments = deployments.length;
        const activeDeployments = deployments.filter(dep =>
            dep.startDate <= now && dep.endDate >= now && dep.status === 'Active'
        ).length;
        const byType = deployments.reduce((acc, dep) => {
            acc[dep.type] = (acc[dep.type] || 0) + 1;
            return acc;
        }, {});
        const byStatus = deployments.reduce((acc, dep) => {
            acc[dep.status] = (acc[dep.status] || 0) + 1;
            return acc;
        }, {});

        return {
            totalDeployments,
            activeDeployments,
            byType,
            byStatus
        };
    } catch (error) {
        console.error('Error getting deployment stats:', error);
        throw error;
    }
};
