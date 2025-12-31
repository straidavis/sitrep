import { foundryService } from '../services/foundryService';

export const getAllApiKeys = async () => {
    try {
        let keys = await foundryService.readDataset('api_keys');
        return keys.map(k => ({ ...k, id: parseInt(k.id || 0) }));
    } catch (e) {
        console.error("Error getting api keys", e);
        return [];
    }
};

export const addApiKey = async (keyData) => {
    return await foundryService.writeDataset('api_keys', keyData, 'APPEND');
};

export const updateApiKey = async (id, updates) => {
    return await foundryService.updateRecord('api_keys', 'id', id, updates);
};

export const deleteApiKey = async (id) => {
    const all = await foundryService.readDataset('api_keys');
    const filtered = all.filter(k => k.id != id);
    return await foundryService.writeDataset('api_keys', filtered, 'SNAPSHOT');
};
