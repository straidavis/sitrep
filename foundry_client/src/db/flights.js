/**
 * Database Operations for Flights
 * Refactored to use FoundryService with Ontology SDK
 */

import { foundrySDKService as foundryService } from '../services/FoundrySDKService';
import { mapFromRaw, mapToRaw } from '../config/schema';
import { calculateFlightMetrics } from '../utils/metrics';

/**
 * Get all flights
 */
export const getAllFlights = async (filters = {}) => {
    try {
        // Use Ontology Read
        const rawFlights = await foundryService.getAllFlights();

        console.log('[DEBUG] Ontology Flights Data (First 2):', rawFlights.slice(0, 2));
        if (rawFlights.length > 0) {
            console.log('[DEBUG] First Flight Keys:', Object.keys(rawFlights[0]));
        }

        // Map from Ontology Schema to Application Schema using Centralized Config
        let flights = rawFlights.map(f => {
            const mapped = mapFromRaw('flights', f);
            // Ensure ID (Fallback if schema didn't catch it)
            if (!mapped.id) mapped.id = f.$primaryKey || f.id || `flight-${Date.now()}-${Math.random()}`;
            return mapped;
        });

        // Apply filters
        if (filters.deploymentId) {
            const targetId = String(filters.deploymentId);
            flights = flights.filter(f => f.deploymentId === targetId);
        }
        if (filters.status) flights = flights.filter(f => f.status === filters.status);
        if (filters.aircraftNumber) flights = flights.filter(f => f.aircraftNumber === filters.aircraftNumber);
        if (filters.missionNumber) flights = flights.filter(f => f.missionNumber.includes(filters.missionNumber));

        return flights.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    } catch (error) {
        console.error('Error getting flights:', error);
        return [];
    }
};

export const getFlightById = async (id) => {
    try {
        let flights = await getAllFlights();
        return flights.find(f => f.id == id);
    } catch (error) {
        console.error('Error getting flight:', error);
        throw error;
    }
};

/**
 * Add new flight via Ontology
 */
export const addFlight = async (flightData, user) => {
    try {
        const newId = Date.now(); // PK Generation
        const fullData = { ...flightData, id: newId, updatedBy: user?.name || 'Unknown' };

        // Map to Ontology Format
        const ontologyObject = mapToRaw('flights', fullData);

        // Manual Patch Removed: Action no longer requires 'abortOrDelay'

        // Action now accepts 'missionNumber' (PK) as requested.
        // We do NOT delete it.

        await foundryService.createObject('flights', ontologyObject);
        return newId;
    } catch (error) {
        console.error('Error adding flight:', error);
        throw error;
    }
};

/**
 * Update flight via Ontology
 */
export const updateFlight = async (id, updates, user) => {
    try {
        // Map updates to Ontology Properties
        const updateData = { ...updates, updatedBy: user?.name || 'Unknown' };
        const ontologyUpdates = mapToRaw('flights', updateData);

        // Cannot update Primary Key.
        // Even if Action 'requires' it (misconfiguration), sending it throws "CannotEditPrimaryKeyProperties".
        // We delete it here. User must fix Action to NOT require it or NOT map it to the PK property.
        delete ontologyUpdates.missionNumber;

        await foundryService.updateObject('flights', id, ontologyUpdates);
        return id;
    } catch (error) {
        // Handle 404 (Object Not Found) by attempting to Create (Upsert)
        if (error.message && error.message.includes('404')) {
            console.warn(`[Flight Update] Update failed (404). Attempting UPSERT (Create) for ID: ${id}...`);
            try {
                const createData = { ...updates, id: id, updatedBy: user?.name || 'Unknown' };
                const ontologyObject = mapToRaw('flights', createData);

                await foundryService.createObject('flights', ontologyObject);
                console.log(`[Flight Update] UPSERT Successful for ID: ${id}`);
                return id;
            } catch (createError) {
                console.error('[Flight Update] Upsert (Create) failed:', createError);
                throw createError;
            }
        }

        console.error('Error updating flight:', error);
        throw error;
    }
};

/**
 * Delete flight via Ontology
 */
export const deleteFlight = async (id) => {
    try {
        await foundryService.deleteObject('flights', id);
    } catch (error) {
        console.error('Error deleting flight:', error);
        throw error;
    }
};

/**
 * Bulk import flights
 * @param {Array} flightsList
 * @returns {Promise<number>} - Number of flights imported
 */
export const bulkImportFlights = async (flightsList) => {
    try {
        const now = new Date().toISOString();
        const mappedList = flightsList.map(f => {
            // Map App Model -> Raw Model
            const raw = mapToRaw('flights', { ...f, updatedBy: now });
            return raw;
        });

        const current = await foundryService.readDataset('flights'); // NOTE: Bulk import might still use Dataset append if generic
        // OSDK usually doesn't do bulk append easily without Batch API.
        // If we are using dataset for import, we need to ensure keys match Dataset CSV headers.
        // If schema.js sources[0] matches CSV headers (snake_case vs Title Case?), this works.
        // 'flights' schema uses snake_case keys (mission_number).
        // Check if existing bulk import used Title Case?
        // Old code: 'Mission_': f.missionNumber. 
        // My schema has 'Mission_' as 3rd source. 
        // WARNING: mapToRaw uses FIRST source.
        // If Dataset headers are different from Ontology properties, we have a problem.
        // Assuming we are migrating to Ontology everywhere, we should use createFlight loops or batch if available.
        // BUT `foundryService.writeDataset` implies we are writing to the backing dataset.
        // Let's assume for now we write to dataset using snake_case properties which hopefully match.
        // Or cleaner: Use `Promise.all(flightsList.map(addFlight))` to use the Ontology path?
        // The old code `foundryService.writeDataset` suggests direct dataset manipulation.
        // Let's switch to iterate addFlight to be safe and consistent with "Direct Object Edits".

        // However, `bulkImportFlights` was doing append? 
        // Let's use `addFlight` loop for now. It's safer for OSDK.
        await Promise.all(flightsList.map(f => addFlight(f, { name: 'Bulk Import' })));

        return mappedList.length;
    } catch (error) {
        console.error('Error bulk importing flights:', error);
        throw error;
    }
};

/**
 * Search flights
 * @param {string} searchTerm
 * @returns {Promise<Array>}
 */
export const searchFlights = async (searchTerm) => {
    try {
        const term = searchTerm.toLowerCase();
        const flights = await getAllFlights();

        return flights.filter(f =>
            (f.missionNumber || '').toLowerCase().includes(term) ||
            (f.aircraftNumber || '').toLowerCase().includes(term) ||
            (f.notes || '').toLowerCase().includes(term)
        );
    } catch (error) {
        console.error('Error searching flights:', error);
        throw error;
    }
};


