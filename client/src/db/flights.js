/**
 * Database Operations for Flights
 */

import { db } from './schema';
import { api } from '../services/api';
import { config } from '../config';

const useRemote = () => config.authMode === 'microsoft';

/**
 * Get all flights
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>}
 */
export const getAllFlights = async (filters = {}) => {
    try {
        if (useRemote()) {
            let flights = await api.get('v1/flights');

            // Client-side filtering
            if (filters.startDate && filters.endDate) {
                flights = flights.filter(f => f.date >= filters.startDate && f.date <= filters.endDate);
            }
            if (filters.tailNumber) flights = flights.filter(f => f.tailNumber === filters.tailNumber);
            if (filters.missionType) flights = flights.filter(f => f.missionType === filters.missionType);
            if (filters.status) flights = flights.filter(f => f.status === filters.status);

            return flights.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

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
 * @param {Object} user - User object for auditing
 * @returns {Promise<number>} - ID of created flight
 */
export const addFlight = async (flightData, user) => {
    try {
        const now = new Date().toISOString();
        const flight = {
            ...flightData,
            createdAt: now,
            updatedAt: now,
            lastUpdatedBy: user?.name || 'Unknown'
        };

        if (useRemote()) {
            const result = await api.post('v1/flights', flight);
            return result.id;
        }

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
 * @param {Object} user - User object for auditing
 * @returns {Promise<number>}
 */
export const updateFlight = async (id, updates, user) => {
    try {
        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: user?.name || 'Unknown'
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
        let flights = await getAllFlights({});

        if (deploymentIds) {
            // Handle both single ID (legacy) and array
            const ids = Array.isArray(deploymentIds)
                ? deploymentIds.map(id => parseInt(id))
                : [parseInt(deploymentIds)];

            if (ids.length > 0 && !ids.includes(NaN)) {
                flights = flights.filter(f => ids.includes(f.deploymentId));
            }
        }

        const totalFlights = flights.length;
        const totalHours = flights.reduce((sum, f) => sum + (f.hours || 0), 0);
        const importConstants = await import('../utils/constants');
        const getResponsibleParty = importConstants.getResponsibleParty;

        const byStatus = {}; // Will populate in loop below

        // --- Updated MRR & Tasking Logic (User Defined) ---
        // Denominator (Common): All events - (CNX where Party != 'Shield AI')
        // MRR Numerator: Complete + Delay
        // Tasking Numerator: Complete + Delay + Alert

        let mrrNumerator = 0;       // Complete + Delay
        let taskingNumerator = 0;   // Complete + Delay + Alert
        let denominator = 0;        // Total - Excluded CNX

        flights.forEach(f => {
            const status = f.status ? f.status.trim() : '';

            // Normalize status for check
            const isComplete = status === 'Complete';
            const isDelay = status === 'Delay';
            const isAlert = status === 'Alert - No Launch' || status === 'Alert'; // Handle legacy 'Alert'
            const isCNX = status === 'CNX' || status === 'Cancelled';

            // Determine Responsible Party for CNX
            let party = f.responsibleParty;
            if (!party && f.reasonForDelay) {
                party = getResponsibleParty(f.reasonForDelay);
            }
            const isShieldAIFault = party === 'Shield AI';

            // Populate byStatus (Split CNX)
            let displayStatus = status;
            if (isCNX && isShieldAIFault) {
                displayStatus = 'CNX - Shield AI';
            }
            if (displayStatus) {
                byStatus[displayStatus] = (byStatus[displayStatus] || 0) + 1;
            }

            // Denominator Logic: Include everything EXCEPT CNX due to Others/USCG
            // i.e., Include if NOT (CNX and !ShieldAIFault)
            // Stated differently: Include if (Not CNX) OR (CNX and ShieldAIFault)

            let includeInDenominator = true;
            if (isCNX && !isShieldAIFault) {
                includeInDenominator = false;
            }

            if (includeInDenominator) {
                denominator++;
            }

            // Numerator Logic
            if (isComplete || isDelay) {
                mrrNumerator++;
                taskingNumerator++;
            } else if (isAlert) {
                taskingNumerator++;
            }
        });

        // MRR
        const currentMRR = denominator > 0 ? (mrrNumerator / denominator) * 100 : 100;

        // Tasking Rating
        const currentTaskingRate = denominator > 0 ? (taskingNumerator / denominator) * 100 : 100;

        // Flights to 95% MRR
        // (S + x) / (D + x) >= 0.95
        let flightsTo95 = 0;
        if (currentMRR < 95) {
            const numerator = (0.95 * denominator) - mrrNumerator;
            const res = numerator / 0.05;
            flightsTo95 = Math.ceil(res);
            if (flightsTo95 < 0) flightsTo95 = 0;
        }

        const totalContraband = flights.reduce((sum, f) => sum + (parseFloat(f.contraband) || 0), 0);
        const totalDetainees = flights.reduce((sum, f) => sum + (parseInt(f.detainees) || 0), 0);
        const totalTOIs = flights.reduce((sum, f) => sum + (parseInt(f.tois) || 0), 0);

        return {
            totalFlights,
            totalHours,
            totalContraband,
            totalDetainees,
            totalTOIs,
            byStatus,
            missionReliability: currentMRR,
            taskingRating: currentTaskingRate,
            flightsTo95MRR: flightsTo95,
            debug: { mrrNumerator, taskingNumerator, denominator }
        };
    } catch (error) {
        console.error('Error getting flight stats:', error);
        throw error;
    }
};
