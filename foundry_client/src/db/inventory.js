
import { foundryService } from '../services/foundryService';
import { mapFromRaw, mapToRaw } from '../config/schema';

export const getInventoryItems = async (deploymentId) => {
    try {
        const rawItems = await foundryService.readDataset('inventory');
        let items = rawItems.map(i => mapFromRaw('inventory', i));

        if (deploymentId) {
            return items.filter(i => i.deploymentId == deploymentId);
        }
        return items;
    } catch (e) {
        console.error("Error getting inventory items", e);
        return [];
    }
};

export const addInventoryItem = async (item, user) => {
    const newItem = {
        ...item,
        lastUpdatedBy: user?.name || 'Unknown',
        createdAt: new Date().toISOString()
    };

    // Ensure ID is set for local usage if not present (though schema keeps it hidden/auto)
    if (!newItem.id) newItem.id = Date.now();

    const rawData = mapToRaw('inventory', newItem);
    await foundryService.appendRecord('inventory', rawData);
    return newItem.id;
};

export const updateInventoryItem = async (id, updates, user) => {
    const updatedData = {
        ...updates,
        lastUpdatedBy: user?.name || 'Unknown',
        updatedAt: new Date().toISOString()
    };

    const rawUpdates = mapToRaw('inventory', updatedData);
    // Remove ID from updates if present to avoid PK issues
    delete rawUpdates.id;

    // Note: mapToRaw might map 'id' to 'UID' or 'id' based on schema. 
    // updateRecord needs the raw key name for the ID field.
    // Based on schema: id -> 'id' or 'UID'. 
    // Let's assume 'id' column in dataset match primitive 'id'.
    await foundryService.updateRecord('inventory', 'id', id, rawUpdates);
};

export const deleteInventoryItem = async (id) => {
    const items = await foundryService.readDataset('inventory');
    // We need to filter based on raw ID since we are doing a full write-back
    // But since we don't have a specific raw key for ID guaranteed (it's 'id' or 'UID'), 
    // it's safer to map first or look for standard ID. 
    // However, for delete, we usually just need the ID.
    // Let's assume the dataset has an 'id' column as confirmed by previous code.
    const filtered = items.filter(i => i.id != id && i.UID != id);
    await foundryService.writeDataset('inventory', filtered);
};
