import { getResponsibleParty } from './constants';

/**
 * Centralized logic for calculating flight metrics.
 * Used by Reports.jsx and db/flights.js
 */

export const calculateFlightMetrics = (flights) => {
    if (!flights || !Array.isArray(flights)) {
        return {
            totalFlights: 0,
            totalHours: 0,
            completed: 0,
            cancelled: 0,
            missionReliability: 100,
            totalTOIs: 0,
            totalContraband: 0,
            totalDetainees: 0
        };
    }

    const totalFlights = flights.length;
    const totalHours = flights.reduce((sum, f) => sum + (parseFloat(f.hours) || 0), 0);

    // Only 'CNX' counts as cancelled for MRR purposes based on Reports.jsx logic
    const cancelled = flights.filter(f => f.status === 'CNX');
    const cancelledCount = cancelled.length;

    // Aborted and Alert - No Launch
    const abortedCount = flights.filter(f => f.status === 'Aborted').length;
    const alertNoLaunchCount = flights.filter(f => f.status === 'Alert - No Launch').length;

    // 'Completed' count - useful for other stats
    const completed = flights.filter(f => ['Completed', 'Complete'].includes(f.status)).length;

    const totalTOIs = flights.reduce((sum, f) => sum + (parseInt(f.tois) || 0), 0);
    const totalContraband = flights.reduce((sum, f) => sum + (parseFloat(f.contraband) || 0), 0);
    const totalDetainees = flights.reduce((sum, f) => sum + (parseInt(f.detainees) || 0), 0);

    // MRR Calculation
    // Logic: 
    // Numerator: Total flights - Total CNX - total abort - alert-no lauch
    // Denominator: Total Flights - Cancellations due to Non-Shield AI Reasons - alert no-launches

    // Calculate Shield AI cancellations explicitly for reporting
    const shieldAiCnx = cancelled.filter(f => {
        const responsible = getResponsibleParty(f.reasonForDelay);
        return responsible === 'Shield AI';
    }).length;

    const nonShieldAICancellations = cancelled.filter(f => {
        const responsible = getResponsibleParty(f.reasonForDelay); // reasonForDelay maps to reasonForCancel via schema
        return responsible !== 'Shield AI';
    }).length;

    // Denominator = Opportunity. 
    // We remove Non-Shield AI CNX (non-chargeable) and Alert-No-Launch.
    // Aborted flights REMAIN in the denominator (chargeable) as they are not explicitly removed.
    const denominator = totalFlights - nonShieldAICancellations - alertNoLaunchCount;

    // Numerator = Successes
    const numerator = totalFlights - cancelledCount - abortedCount - alertNoLaunchCount;

    const missionReliability = denominator > 0
        ? (numerator / denominator) * 100
        : 100;

    // Availability Calculation
    // Logic: Same as MRR but add back Alert - No Launch to numerator and denominator.
    // Denominator = Total Flights - Non-Shield AI Cancellations (includes AlertNoLaunch)
    const availabilityDenominator = totalFlights - nonShieldAICancellations;
    // Numerator = Total Flights - CNX - Aborted (includes AlertNoLaunch)
    const availabilityNumerator = totalFlights - cancelledCount - abortedCount;

    const availability = availabilityDenominator > 0
        ? (availabilityNumerator / availabilityDenominator) * 100
        : 100;

    // On-Time Rating
    // Formula: (Completed) / (Completed + Delayed)
    // Note: 'completed' var above only counts 'Completed/Complete'. 'Delayed' allows for late completion.
    // Making check robust: "Delay", "Delayed", "Flight Delayed", etc.
    const delayedFlights = flights.filter(f =>
        f.status &&
        f.status.toLowerCase().includes('delay') &&
        parseFloat(f.hours || 0) > 0 // Only count as "Delayed" if it actually flew (hours > 0). If 0, it's a cancellation.
    ).length;

    // Total flown successfully = Completed (on time) + Delayed (late)
    const flownFlights = completed + delayedFlights;

    let onTimeRating = 100;
    if (flownFlights > 0) {
        onTimeRating = ((flownFlights - delayedFlights) / flownFlights) * 100;
    }

    // Flights to 95% MRR
    // Formula: X >= (Target*Denominator - Numerator) / (1 - Target)
    const target = 0.95;
    let flightsTo95 = 0;

    // Use MRR denominator and numerator
    if (denominator > 0) {
        const currentRatio = numerator / denominator;
        if (currentRatio < target) {
            flightsTo95 = Math.ceil((target * denominator - numerator) / (1 - target));
        }
    } else {
        // If denominator is 0, we have 0 flights or all are non-chargeable.
        // Assuming starting from scratch, 0 flights needed to be at 100% (which is > 95%).
        flightsTo95 = 0;
    }

    return {
        totalFlights,
        totalHours: parseFloat(totalHours.toFixed(1)), // Ensure float precision
        completed,
        cancelled: cancelledCount,
        shieldAiCnx,
        missionReliability: parseFloat(missionReliability.toFixed(1)),
        availability: parseFloat(availability.toFixed(1)),
        onTimeRating: parseFloat(onTimeRating.toFixed(1)),
        flightsTo95,
        totalTOIs,
        totalContraband: parseFloat(totalContraband.toFixed(1)),
        totalDetainees
    };
};

