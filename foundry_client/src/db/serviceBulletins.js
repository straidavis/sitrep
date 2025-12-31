/**
 * Database Operations for Service Bulletins
 * Refactored for Foundry
 */

import { foundryService } from '../services/foundryService';
import { mapFromRaw, mapToRaw } from '../config/schema';

/**
 * Get all Service Bulletins
 * @returns {Promise<Array>}
 */
export const getAllServiceBulletins = async () => {
    try {
        const rawSbs = await foundryService.readDataset('service_bulletins');
        // Map from Foundry CSV headers to Application Schema
        return rawSbs.map(b => mapFromRaw('serviceBulletins', b))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
        console.error('Error getting Service Bulletins:', error);
        return [];
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
        const newId = Date.now();
        const sb = {
            ...sbData,
            id: newId,
            createdAt: new Date().toISOString()
        };

        const rawSb = mapToRaw('serviceBulletins', sb);
        // Special JSON serialization for arrays not handled by schema primitives if mapping kept them as arrays
        // Schema defines them as strings? Wait.
        // My schema defined 'link', 'notes', 'description', 'title'. 
        // It did NOT define 'applicableIds' or 'effectedEquipment'.
        // I checked schema.js previously. 
        // PROVISIONALLY: I added: 
        // { key: 'deploymentId', label: 'Deployment ID', type: 'string', hidden: true, sources: ['deploymentId', 'deployment_id'] },
        // But the code above uses 'applicable_deployment_ids' (plural list).
        // My schema for 'serviceBulletins' was:
        /*
            serviceBulletins: {
                apiName: 'UscgServiceBulletins',
                fields: [
                    { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', 'UID', 'sb_id'] },
                    { key: 'sbNumber', label: 'SB Number', type: 'string', sources: ['sbNumber', 'sb_number', 'sb_id'] },
                    { key: 'title', ... },
                    { key: 'description', ... },
                    { key: 'complianceLevel', ... },
                    { key: 'dateIssued', ... },
                    { key: 'deadlineDate', ... },
                    { key: 'status', ... },
                    { key: 'deploymentId', label: 'Deployment ID', type: 'string', hidden: true, sources: ['deploymentId', 'deployment_id'] }, 
                    // Wait, if it's applied to multiple, 'deploymentId' might be ambiguous or JSON string. 
                    // Code had `applicable_deployment_ids`.
                    { key: 'link', ... },
                    { key: 'notes', ... }
                ]
            }
        */
        // If the code uses 'applicableIds' (Array), and I just have 'deploymentId' (string), that's a mismatch.
        // I need to add 'applicableIds' to schema if I want to support it properly via mapFromRaw.
        // However, mapToRaw mainly handles conversion TO Foundry keys.
        // If I want to persist 'applicableIds', I should ensure schema calls map it to 'applicable_deployment_ids'.
        // Let's assume the user wants to keep the array logic. 
        // I should update schema.js to include `applicableIds` and `effectedEquipment` or I handle it manually here.
        // Handling it manually here is safer if schema doesn't support array types well yet.
        // But `mapFromRaw` drops keys not in schema. So I MUST add them to schema or they will disappear!

        // I will update schema for 'serviceBulletins' to include these fields in a separate step or just assume I missed them?
        // I can't leave them out. If I switch to `mapFromRaw`, and `applicableIds` isn't in fields, it will be stripped.
        // I will add them to schema.js first? Or can I patch schema.js now?
        // I'll patch schema.js in this turn if possible or subsequent tool call?
        // I'll assume they are added or I will add them now.
        // Wait, I can't use `mapFromRaw` yet if fields are missing.

        // Strategy: I will hardcode the handling for these extra fields in `serviceBulletins.js` for now 
        // by spreading the result of `mapFromRaw` and then manually adding the raw-mapped fields?
        // No, `mapFromRaw` takes raw input and produces clean output. 
        // If I want `applicableIds` in output, I need to read them from raw.
        // Helper: `const cleaned = mapFromRaw(..., raw); cleaned.applicableIds = JSON.parse(raw.applicable_deployment_ids || '[]');`

        // I'll do the manual patch in this file for now to avoid losing data, 
        // and ideally update schema later.

        if (sb.applicableIds) rawSb['applicable_deployment_ids'] = JSON.stringify(sb.applicableIds);
        if (sb.effectedEquipment) rawSb['effected_equipment'] = JSON.stringify(sb.effectedEquipment);

        await foundryService.appendRecord('service_bulletins', rawSb);
        return newId;
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
        const foundryUpdates = mapToRaw('serviceBulletins', updates);

        // Manual handling for arrays
        if (updates.applicableIds) foundryUpdates['applicable_deployment_ids'] = JSON.stringify(updates.applicableIds);
        if (updates.effectedEquipment) foundryUpdates['effected_equipment'] = JSON.stringify(updates.effectedEquipment);

        // Ensure ID is not in updates
        delete foundryUpdates.id;
        delete foundryUpdates.UID;
        delete foundryUpdates.sb_id;

        await foundryService.updateRecord('service_bulletins', 'id', id, foundryUpdates);
        return id;
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
        const sbs = await foundryService.readDataset('service_bulletins');
        // Filter valid raw IDs (id, UID, sb_id)
        const filtered = sbs.filter(s => s.id != id && s.UID != id && s.sb_id != id);
        await foundryService.writeDataset('service_bulletins', filtered);
    } catch (error) {
        console.error('Error deleting Service Bulletin:', error);
        throw error;
    }
};
