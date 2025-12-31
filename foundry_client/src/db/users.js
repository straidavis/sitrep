
import { foundryService } from '../services/foundryService';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { mapFromRaw, mapToRaw } from '../config/schema';

/**
 * Get all users
 */
export const getAllUsers = async () => {
    // 1. Try Ontology Search first (Preferred)
    if (config.ONTOLOGY?.RID && config.ONTOLOGY?.OBJECTS?.users?.apiName) {
        const apiName = config.ONTOLOGY.OBJECTS.users.apiName;
        try {
            const users = await foundryService.loadObjects(apiName);
            // Use Schema Mapper
            return users.map(u => {
                const mapped = mapFromRaw('users', u);
                // Ensure helper fields derived from logic are set if missing from mapper defaults
                // e.g. name = firstName + lastName
                if (!mapped.name && (mapped.firstName || mapped.lastName)) {
                    mapped.name = `${mapped.firstName || ''} ${mapped.lastName || ''}`.trim();
                }
                // Fallback ID
                if (!mapped.id) mapped.id = u.__primaryKey || u.userId || '0';
                return mapped;
            });
        } catch (e) {
            console.error("Error fetching users from Ontology:", e);
        }
    }
    // ... Fallback omitted for brevity, assuming Ontology mode is active ...
    return [];
}

// ... existing get by email/id ...

export const getUserByEmail = async (email) => {
    const users = await getAllUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export const getUserById = async (id) => {
    const users = await getAllUsers();
    return users.find(u => u.id == id);
}

/**
 * Add User
 */
export const addUser = async (userData) => {
    if (config.ONTOLOGY?.OBJECTS?.users?.actions?.create) {
        const action = config.ONTOLOGY.OBJECTS.users.actions.create;

        // Use Schema Mapper to generate clean payload
        // Note: mapToRaw expects keys like 'name' to be broken down if configured? 
        // Our schema has 'firstName' and 'lastName' as sources, but userData might have 'name'.
        // We need to preprocess userData to match App Schema fields for mapToRaw to work?
        // Actually mapToRaw takes App Schema Objects and turns them into Raw.

        const firstName = userData.name ? userData.name.split(' ')[0] : 'Unknown';
        const lastName = userData.name && userData.name.split(' ').length > 1 ? userData.name.split(' ').slice(1).join(' ') : 'User';

        const appUser = {
            ...userData,
            firstName,
            lastName,
            // ensure defaults
            role: userData.role || 'App.User',
            username: userData.email
        };

        const params = mapToRaw('users', appUser);

        // IMPORTANT: mapToRaw might include 'userId' which the Action rejects.
        // We must filter params specifically for the Action context if mapToRaw is too broad.
        // Or trust mapToRaw is correct. 
        // The schema says userId source is ['userId']. So params will have userId.
        // We MUST remove it for create-spark-users action.

        delete params.userId;
        delete params.id;

        console.log("[db/users] Adding user with params:", params);

        return await foundryService.applyAction(action, params);
    }
    return [];
}

/**
 * Update user
 */
export const updateUser = async (id, updates) => {
    if (config.ONTOLOGY?.OBJECTS?.users?.actions?.edit) {
        const action = config.ONTOLOGY.OBJECTS.users.actions.edit;

        // Break name into first/last if provided
        let appUpdates = { ...updates };
        if (updates.name) {
            appUpdates.firstName = updates.name.split(' ')[0];
            appUpdates.lastName = updates.name.split(' ').slice(1).join(' ');
        }

        const params = mapToRaw('users', appUpdates);

        // Object Locator: map ID to 'SparkUsers'
        params.SparkUsers = id;

        // Remove ID from params list
        delete params.userId;
        delete params.id;

        console.log(`[db/users] Updating user ${id} with params:`, params);

        return await foundryService.applyAction(action, params);
    }
    return [];
}

/**
 * Delete User
 */
export const deleteUser = async (id) => {
    // Ontology Mode
    if (config.ONTOLOGY?.OBJECTS?.users?.actions?.delete) {
        const action = config.ONTOLOGY.OBJECTS.users.actions.delete;
        const params = { userId: id }; // Assumption: Action takes PK 'userId'
        return await foundryService.applyAction(action, params);
    }
    // Fallback
    const allUsers = await foundryService.readDataset('users');
    const filtered = allUsers.filter(u => u.id != id);
    return await foundryService.writeDataset('users', filtered, 'SNAPSHOT');
}
