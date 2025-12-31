import { foundryService } from '../services/foundryService';

export const getAllAccessRequests = async () => {
    // Current implementation relies on a legacy dataset that causes errors.
    // Disabling for now as per user request to clean up 400 errors.
    return [];
};

export const addAccessRequest = async (requestData) => {
    return await foundryService.writeDataset('access_requests', requestData, 'APPEND');
};

export const updateAccessRequest = async (id, updates) => {
    return await foundryService.updateRecord('access_requests', 'id', id, updates);
};

export const deleteAccessRequest = async (id) => {
    const all = await foundryService.readDataset('access_requests');
    const filtered = all.filter(r => r.id != id);
    return await foundryService.writeDataset('access_requests', filtered, 'SNAPSHOT');
};
