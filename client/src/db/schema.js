/**
 * SITREP Database Schema
 * IndexedDB implementation using Dexie
 */

import Dexie from 'dexie';

export const db = new Dexie('SITREPDatabase');

// Handle version changes (multi-tab support)
db.on('versionchange', function (event) {
    if (confirm("Database version change detected. Reload page to update?")) {
        window.location.reload();
    }
    return false; // Let the other tab know we are handling it (by closing/reloading)
});

// Define database schema
db.version(12).stores({
    flights: '++id, date, missionNumber, aircraftNumber, launcher, numberOfLaunches, status, deploymentId, scheduledLaunchTime, launchTime, recoveryTime, createdAt, updatedAt',
    equipment: '++id, date, category, equipment, serialNumber, status, deploymentId, location, software, createdAt, updatedAt',
    deployments: '++id, name, type, startDate, endDate, location, userEmails, createdAt, updatedAt, lastInventoryUpdate', // added lastInventoryUpdate
    personnel: '++id, name, rank, role, createdAt, updatedAt',
    users: '++id, email, passwordHash, tempPassword, mustChangePassword, role, addedBy, createdAt', // Local permission overrides
    apiKeys: '++id, key, name, status, createdAt', // For external access
    settings: 'key',
    kits: '++id, name, version, deploymentId, createdAt',
    kitItems: '++id, kitId, partNumber, description, quantity, category, serialNumber, actualQuantity',
    inventoryItems: '++id, deploymentId, partNumber, description, quantity, category, location, notes, createdAt, updatedAt',
    shipments: '++id, uid, deploymentId, orderDate, shipDate, hostReceivedDate, siteReceivedDate, status, createdAt',
    shipmentItems: '++id, shipmentId, partNumber, description, quantity, serialNumber, isNewItem, receivedDate',
    accessRequests: '++id, email, name, status, requestedAt', // status: 'Pending', 'Approved', 'Denied'
    partsUtilization: '++id, deploymentId, partNumber, description, quantity, type, date, createdAt' // type: 'Scheduled', 'Unscheduled'
});

// Type definitions for TypeScript-like intellisense
/**
 * @typedef {Object} Flight
 * @property {number} id - Auto-incremented ID
 * @property {string} date - ISO date string
 * @property {string} status - Flight status (Complete, CNX, Delay, Alert)
 * @property {string} missionNumber - Auto-generated mission number (YYMMDD_AircraftNumber)
 * @property {string} aircraftNumber - Aircraft number from equipment dropdown
 * @property {string} launcher - Launcher used for the flight
 * @property {number} numberOfLaunches - Number of launches in this flight event
 * @property {number} deploymentId - Associated deployment ID
 * @property {string} scheduledLaunchTime - Scheduled launch time
 * @property {string} launchTime - Actual launch time
 * @property {string} recoveryTime - Recovery/landing time
 * @property {number} hours - Flight hours (auto-calculated)
 * @property {string} payload1 - Payload 1 from equipment (payloads category)
 * @property {string} payload2 - Payload 2 from equipment (payloads category)
 * @property {string} payload3 - Payload 3 from equipment (payloads category)
 * @property {string} reasonForDelay - Reason for Cancel, Abort or Delay
 * @property {string} weather - Weather conditions (single line text)
 * @property {string} winds - Wind speed and direction (format: speed@direction)
 * @property {number} oat - Outside Air Temperature (integer)
 * @property {string} riskLevel - Risk level (High, Med, Low)
 * @property {string} reasonForRisk - Reason for elevated risk
 * @property {number} tois - TOIs (integer)
 * @property {string} notes - Additional notes
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} Equipment
 * @property {number} id - Auto-incremented ID
 * @property {string} date - ISO date string
 * @property {string} category - Equipment category (Aircraft, Payloads, Launchers, GCS, Radios)
 * @property {string} equipment - Equipment name/identifier
 * @property {string} serialNumber - Serial number
 * @property {string} status - Equipment status (FMC, PMC, NMC, CAT5)
 * @property {number} deploymentId - Associated deployment ID
 * @property {string} location - Current location
 * @property {string} software - Software version/info
 * @property {string} comments - Additional comments
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} Deployment
 * @property {number} id - Auto-incremented ID
 * @property {string} name - Deployment name
 * @property {string} type - Deployment type (Shore/Ship)
 * @property {string} startDate - ISO date string
 * @property {string} endDate - ISO date string
 * @property {string} location - Deployment location
 * @property {string[]} personnel - Array of personnel IDs
 * @property {number[]} equipment - Array of equipment IDs
 * @property {Object} financials - Financial tracking
 * @property {number} financials.clins15Day - 15-day CLIN amount
 * @property {number} financials.clins1Day - 1-day CLIN amount
 * @property {number} financials.overAndAbove - Over and above amount
 * @property {string} status - Deployment status
 * @property {string} notes - Additional notes
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} Setting
 * @property {string} key - Setting key
 * @property {any} value - Setting value
 */

export default db;
