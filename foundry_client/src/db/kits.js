
import { foundryService } from '../services/foundryService';
import { getAllDeployments } from './deployments';
import { mapFromRaw, mapToRaw } from '../config/schema';

/**
 * Get all kits
 */
export const getAllKits = async () => {
    try {
        const rawKits = await foundryService.readDataset('kits');
        return rawKits.map(k => mapFromRaw('kits', k));
    } catch (e) {
        console.error("Error getting kits", e);
        return [];
    }
}

/**
 * Get all kit items
 */
export const getAllKitItems = async () => {
    try {
        const rawItems = await foundryService.readDataset('kit_items');
        return rawItems.map(i => mapFromRaw('kitItems', i));
    } catch (e) {
        console.error("Error getting kit items", e);
        return [];
    }
}

/**
 * Get kits by deployment
 */
export const getKitsByDeployment = async (deploymentId) => {
    const kits = await getAllKits();
    return kits.filter(k => k.deploymentId == deploymentId);
}

/**
 * Get items for list of kit IDs
 */
export const getKitItemsByKitIds = async (kitIds) => {
    const allItems = await getAllKitItems();
    return allItems.filter(i => kitIds.includes(i.kitId));
}

/**
 * Add Kit
 */
export const addKit = async (kitData) => {
    const newId = Date.now();
    const kit = {
        ...kitData,
        id: newId,
        createdAt: new Date().toISOString()
    };
    const rawKit = mapToRaw('kits', kit);
    await foundryService.appendRecord('kits', rawKit);
    return newId;
}

/**
 * Update Kit
 * @param {number|string} id 
 * @param {Object} updates 
 */
export const updateKit = async (id, updates) => {
    // Map updates to raw
    const rawUpdates = mapToRaw('kits', updates);
    // Don't modify ID
    delete rawUpdates.id;
    delete rawUpdates.UID;

    await foundryService.updateRecord('kits', 'id', id, rawUpdates);
}

/**
 * Delete Kit
 */
export const deleteKit = async (id) => {
    const kits = await foundryService.readDataset('kits');
    const filtered = kits.filter(k => k.id != id && k.UID != id);
    await foundryService.writeDataset('kits', filtered);
}

/**
 * Add Kit Items (Bulk)
 */
export const bulkAddKitItems = async (items) => {
    const currentItems = await foundryService.readDataset('kit_items');
    const newItems = items.map(i => {
        const item = {
            ...i,
            id: i.id || (Date.now() + Math.random())
        };
        return mapToRaw('kitItems', item);
    });

    // We need to write RAW data back
    // currentItems are raw from readDataset? Yes.
    const updated = [...currentItems, ...newItems];
    await foundryService.writeDataset('kit_items', updated);
}

/**
 * Delete items for a kit
 */
export const deleteKitItemsByKitId = async (kitId) => {
    const items = await foundryService.readDataset('kit_items');
    // Filter raw items. We assume raw column is 'kit_id' or 'kitId'.
    // Better to map them to check safely, but inefficient for large writes.
    // Let's check common raw keys.
    const filtered = items.filter(i => (i.kit_id != kitId && i.kitId != kitId) || (i.kit_id && String(i.kit_id) !== String(kitId)));
    await foundryService.writeDataset('kit_items', filtered);
}

/**
 * Update Kit Item
 */
export const updateKitItem = async (id, updates, user) => {
    const safeUpdates = { ...updates };
    // mapToRaw expects a full object usually, or just fields. 
    // If we pass partial, mapToRaw helper should handle it if keys match.
    // Our mapToRaw iterates over fields.

    // Let's manually map the updates using schema knowledge to be safe, 
    // or rely on mapToRaw partial support if we implemented it?
    // mapToRaw implementation loops over schema fields. 
    // If attributes not in input, it skips for partial?
    // Checking schema.js logic... schema logic usually constructs a new raw object.

    const rawUpdates = mapToRaw('kitItems', safeUpdates);

    // Add metadata if needed, though kitItems schema doesn't have lastUpdatedBy visible usually
    if (user?.name) {
        // rawUpdates['last_updated_by'] = user.name; // If schema supports it
    }

    delete rawUpdates.id; // Don't update PK
    return await foundryService.updateRecord('kit_items', 'id', id, rawUpdates);
}

/**
 * Get missing kit items for specified deployments
 * @param {Array<number>} deploymentIds 
 * @returns {Promise<Array>}
 */
export const getMissingKitItems = async (deploymentIds = null) => {
    try {
        const kits = await getAllKits();
        let filteredKits = kits;

        if (deploymentIds && deploymentIds.length > 0) {
            const ids = deploymentIds.map(id => String(id).trim());
            filteredKits = kits.filter(k => ids.includes(k.deploymentId));
        }

        if (filteredKits.length === 0) return [];

        const kitIds = filteredKits.map(k => k.id);
        const allItems = await getAllKitItems();
        const relevantItems = allItems.filter(i => kitIds.includes(i.kitId));

        // Get deployments map for naming
        const allDeployments = await getAllDeployments();
        const depMap = allDeployments.reduce((acc, d) => {
            acc[d.id] = d.name;
            return acc;
        }, {});

        const kitMap = filteredKits.reduce((acc, k) => {
            acc[k.id] = { name: k.name, deploymentName: depMap[k.deploymentId] };
            return acc;
        }, {});

        const missing = relevantItems
            .filter(item => {
                const required = parseFloat(item.quantity) || 0;
                const actual = parseFloat(item.actualQuantity) || 0;
                return actual < required;
            })
            .map(item => ({
                ...item,
                kitName: kitMap[item.kitId]?.name,
                deploymentName: kitMap[item.kitId]?.deploymentName,
                missingQuantity: (parseFloat(item.quantity) || 0) - (parseFloat(item.actualQuantity) || 0)
            }));

        return missing;

    } catch (error) {
        console.error('Error fetching missing kit items:', error);
        return [];
    }
};
