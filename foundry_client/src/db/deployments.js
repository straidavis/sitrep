/**
 * Database Operations for Deployments
 * Refactored to use FoundryService
 */

import { foundrySDKService as foundryService } from '../services/FoundrySDKService';
import { mapFromRaw, mapToRaw } from '../config/schema';

/**
 * Get all deployments
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
export const getAllDeployments = async (filters = {}) => {
    try {
        let rawDeployments = await foundryService.getAllDeployments();

        // console.log('[Deployments Debug] Raw data sample:', rawDeployments.slice(0, 2));

        // Map from Raw Ontology to Application Schema
        let deployments = rawDeployments.map(d => {
            const mapped = mapFromRaw('deployments', d);
            // Ensure ID fallback (Prefer SDK's $primaryKey, then id property)
            if (!mapped.id) mapped.id = String(d.$primaryKey || d.id || '').trim();
            return mapped;
        });

        // Apply filters
        if (filters.type) {
            deployments = deployments.filter(dep => dep.type === filters.type);
        }

        if (filters.status) {
            deployments = deployments.filter(dep => dep.status === filters.status);
        }

        if (filters.location) {
            deployments = deployments.filter(dep => dep.location === filters.location);
        }

        return deployments.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    } catch (error) {
        console.error('Error getting deployments:', error);
        return [];
    }
};

/**
 * Get deployment by ID
 * @param {number} id
 * @returns {Promise<Object>}
 */
export const getDeploymentById = async (id) => {
    try {
        const deployments = await getAllDeployments();
        return deployments.find(d => d.id == id);
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
        // If ID passed (upsert), use it, else generate
        const newId = deploymentData.id || Date.now();

        const fullData = {
            ...deploymentData,
            id: newId,
            createdAt: now,
            updatedAt: now
        };

        // Map App Schema -> Foundry Ontology
        const deployment = mapToRaw('deployments', fullData);

        await foundryService.createDeployment(deployment);
        return newId;
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
        const updateData = { ...updates, updatedAt: new Date().toISOString() };
        const foundryUpdates = mapToRaw('deployments', updateData);

        await foundryService.updateDeployment(id, foundryUpdates);
        return id;
    } catch (error) {
        // Handle 404 (Object Not Found) by attempting to Create (Upsert)
        if (error.message && error.message.includes('404')) {
            console.warn(`[Deployment Update] Update failed (404). Attempting UPSERT (Create) for ID: ${id}...`);
            try {
                // Determine full object data for creation
                // We need to merge existing data? No, we likely have full form data in 'updates' 
                // if it came from the Edit Modal which sends full object usually.
                // But specifically 'updates' might be partial.
                // However, based on DeploymentForm.jsx, it sends `deploymentData` which is the FULL form.
                // So we can use `updates` as base.
                await addDeployment({ ...updates, id: id });
                console.log(`[Deployment Update] UPSERT Successful for ID: ${id}`);
                return id;
            } catch (createError) {
                console.error('[Deployment Update] Upsert (Create) failed:', createError);
                throw createError;
            }
        }

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
        await foundryService.deleteDeployment(id);
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
        const deployments = await getAllDeployments();

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
        const deployments = await getAllDeployments();
        const now = new Date().toISOString();

        const totalDeployments = deployments.length;
        const activeDeployments = deployments.filter(dep =>
            dep.startDate <= now && dep.endDate >= now && dep.status === 'Active'
        ).length;

        const byType = deployments.reduce((acc, dep) => {
            const t = dep.type || 'Unknown';
            acc[t] = (acc[t] || 0) + 1;
            return acc;
        }, {});

        const byStatus = deployments.reduce((acc, dep) => {
            const s = dep.status || 'Unknown';
            acc[s] = (acc[s] || 0) + 1;
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
