
import { foundryService } from '../services/foundryService';
import { mapFromRaw, mapToRaw } from '../config/schema';

// Config has "parts_utilization"

export const addPartsUtilization = async (data) => {
    const newItem = {
        ...data,
        createdAt: data.createdAt || new Date().toISOString()
    };
    if (!newItem.id) newItem.id = Date.now();

    const rawItem = mapToRaw('partsUtilization', newItem);
    await foundryService.appendRecord('parts_utilization', rawItem);
    return newItem.id;
};

export const bulkAddPartsUtilization = async (items) => {
    const current = await foundryService.readDataset('parts_utilization');
    const newItems = items.map(i => {
        const item = {
            id: i.id || (Date.now() + Math.random()),
            ...i
        };
        return mapToRaw('partsUtilization', item);
    });
    // Write back mixed (current raw + new raw)
    await foundryService.writeDataset('parts_utilization', [...current, ...newItems]);
}

export const getPartsUtilization = async (deploymentId) => {
    try {
        const rawItems = await foundryService.readDataset('parts_utilization');
        const items = rawItems.map(i => mapFromRaw('partsUtilization', i));

        if (deploymentId) {
            return items.filter(i => i.deploymentId == deploymentId);
        }
        return items;
    } catch (e) {
        console.error("Error getting parts utilization", e);
        return [];
    }
}
