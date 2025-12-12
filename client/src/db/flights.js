/**
 * Database Operations for Flights
 */

import { db } from './schema';

/**
 * Get all flights
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
export const getAllFlights = async (filters = {}) => {
    try {
        let query = db.flights.toCollection();

        // Apply filters
        if (filters.startDate && filters.endDate) {
            query = query.filter(flight =>
                flight.date >= filters.startDate && flight.date <= filters.endDate
            );
        }

        if (filters.tailNumber) {
            query = query.filter(flight =>
                flight.tailNumber === filters.tailNumber
            );
        }

        if (filters.missionType) {
            query = query.filter(flight =>
                flight.missionType === filters.missionType
            );
        }

        if (filters.status) {
            query = query.filter(flight =>
                flight.status === filters.status
            );
        }

        const flights = await query.reverse().sortBy('date');
        return flights;
    } catch (error) {
        console.error('Error getting flights:', error);
        throw error;
    }
};

/**
 * Get flight by ID
 * @param {number} id
 * @returns {Promise<Object>}
 */
export const getFlightById = async (id) => {
    try {
        return await db.flights.get(id);
    } catch (error) {
        console.error('Error getting flight:', error);
        throw error;
    }
};

/**
 * Add new flight
 * @param {Object} flightData
 * @returns {Promise<number>} - ID of created flight
 */
export const addFlight = async (flightData) => {
    try {
        const now = new Date().toISOString();
        const flight = {
            ...flightData,
            createdAt: now,
            updatedAt: now
        };

        return await db.flights.add(flight);
    } catch (error) {
        console.error('Error adding flight:', error);
        throw error;
    }
};

/**
 * Update flight
 * @param {number} id
 * @param {Object} updates
 * @returns {Promise<number>}
 */
export const updateFlight = async (id, updates) => {
    try {
        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };

        return await db.flights.update(id, updatedData);
    } catch (error) {
        console.error('Error updating flight:', error);
        throw error;
    }
};

/**
 * Delete flight
 * @param {number} id
 * @returns {Promise<void>}
 */
export const deleteFlight = async (id) => {
    try {
        await db.flights.delete(id);
    } catch (error) {
        console.error('Error deleting flight:', error);
        throw error;
    }
};

/**
 * Bulk import flights
 * @param {Array} flights
 * @returns {Promise<number>} - Number of flights imported
 */
export const bulkImportFlights = async (flights) => {
    try {
        const now = new Date().toISOString();
        const flightsWithTimestamps = flights.map(flight => ({
            ...flight,
            createdAt: now,
            updatedAt: now
        }));

        await db.flights.bulkAdd(flightsWithTimestamps);
        return flightsWithTimestamps.length;
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
        const flights = await db.flights.toArray();

        return flights.filter(flight =>
            flight.tailNumber?.toLowerCase().includes(term) ||
            flight.missionType?.toLowerCase().includes(term) ||
            flight.departure?.toLowerCase().includes(term) ||
            flight.arrival?.toLowerCase().includes(term) ||
            flight.notes?.toLowerCase().includes(term) ||
            flight.crewMembers?.some(crew => crew.toLowerCase().includes(term))
        );
    } catch (error) {
        console.error('Error searching flights:', error);
        throw error;
    }
};

/**
 * Get flight statistics
 * @returns {Promise<Object>}
 */
export const getFlightStats = async (deploymentIds = null) => {
    try {
        let flights = await db.flights.toArray();

        if (deploymentIds) {
            // Handle both single ID (legacy) and array
            const ids = Array.isArray(deploymentIds)
                ? deploymentIds.map(id => parseInt(id))
                : [parseInt(deploymentIds)];

            // Only filter if we have valid IDs, otherwise show all/none? 
            // If empty array passed, usually means "select all active" or "select none". 
            // In layout, "All Deployments" might mean null or empty array.
            // If null is passed, we show all. If array is passed, we filter by it.
            if (ids.length > 0 && !ids.includes(NaN)) {
                flights = flights.filter(f => ids.includes(f.deploymentId));
            }
        }

        const totalFlights = flights.length;
        const totalHours = flights.reduce((sum, f) => sum + (f.hours || 0), 0);
        const byStatus = flights.reduce((acc, f) => {
            acc[f.status] = (acc[f.status] || 0) + 1;
            return acc;
        }, {});
        const byMissionType = flights.reduce((acc, f) => {
            // Assuming missionType might not exist in new schema, but keeping for compatibility if needed
            // Or remove if not used. The new schema uses missionNumber.
            // Let's just keep status breakdown for now as per dashboard.
            return acc;
        }, {});

        return {
            totalFlights,
            totalHours,
            byStatus
        };
    } catch (error) {
        console.error('Error getting flight stats:', error);
        throw error;
    }
};
