import { foundryService } from '../services/foundryService';
import initialData from './initialData.json';

const excelDateToJSDate = (serial) => {
    if (!serial) return null;
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date;
};

const excelTimeToString = (serial) => {
    if (!serial && serial !== 0) return '';
    const fractional_day = serial - Math.floor(serial);
    const total_seconds = Math.floor(86400 * fractional_day);
    const hours = Math.floor(total_seconds / 3600);
    const minutes = Math.floor((total_seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const seedDatabase = async () => {
    try {
        console.log('Starting database seed...');

        // 1. Create Deployment
        let deploymentId;
        const deployments = await foundryService.readDataset('deployments');
        const existingDeployment = deployments.find(d => d.name === 'USCG MIDGETT');

        if (existingDeployment) {
            deploymentId = existingDeployment.id;
            console.log('Using existing deployment:', deploymentId);
        } else {
            const newId = Date.now();
            deploymentId = newId;
            const newDeployment = {
                id: newId,
                name: 'USCG MIDGETT',
                location: 'At Sea',
                type: 'Ship',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'Active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Append to deployments
            const updatedDeployments = [...deployments, newDeployment];
            await foundryService.writeDataset('deployments', updatedDeployments);
            console.log('Created new deployment:', deploymentId);
        }

        // 2. Seed Flights
        const flightsData = initialData['SPARK Data'];
        if (flightsData && flightsData.length > 0) {
            // Read existing flights first
            const currentFlights = await foundryService.readDataset('flights');

            const newFlights = flightsData.map(row => {
                const date = excelDateToJSDate(row['Date']);
                return {
                    id: Date.now() + Math.random(), // Unique ID
                    date: date ? date.toISOString() : new Date().toISOString(),
                    status: row['Status'] || 'Complete',
                    missionNumber: row['Mission #']?.toString() || '',
                    aircraftNumber: row['Aircraft #']?.toString() || '',
                    scheduledLaunchTime: excelTimeToString(row['Scheduled Launch']),
                    launchTime: excelTimeToString(row['Launch Time ']),
                    recoveryTime: excelTimeToString(row['Recovery Time']),
                    hours: typeof row['Hours'] === 'number' ? row['Hours'] : 0,
                    riskLevel: row['Risk Level'] || 'Low',
                    notes: row['Notes'] || '',
                    payload1: row['Payload 1'] || '',
                    payload2: row['Payload 2'] || '',
                    weather: row['Weather'] || '',
                    winds: row['Winds'] || '',
                    oat: row['OAT']?.toString() || '',
                    reasonForDelay: row['REASON for Cancel, Abort or Delay'] || '',
                    deploymentId: deploymentId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            });

            const updatedFlights = [...currentFlights, ...newFlights];
            await foundryService.writeDataset('flights', updatedFlights);
            console.log(`Seeded ${newFlights.length} flights`);
        }

        // 3. Seed Equipment
        const equipmentData = initialData['Equipment Data'];
        if (equipmentData && equipmentData.length > 0) {
            const currentEquipment = await foundryService.readDataset('equipment');

            const validEquipment = equipmentData
                .filter(row => row['Data'] !== 'Date')
                .map(row => {
                    const date = excelDateToJSDate(row['Data']);
                    return {
                        id: Date.now() + Math.random(),
                        date: date ? date.toISOString() : new Date().toISOString(),
                        category: row['__EMPTY'] || 'Other',
                        equipment: row['__EMPTY_1'] || '',
                        serialNumber: row['__EMPTY_2']?.toString() || '',
                        status: row['__EMPTY_3'] || 'FMC',
                        location: row['__EMPTY_4'] || '',
                        software: row['__EMPTY_5']?.toString() || '',
                        comments: row['__EMPTY_6'] || '',
                        deploymentId: deploymentId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                });

            const updatedEquipment = [...currentEquipment, ...validEquipment];
            await foundryService.writeDataset('equipment', updatedEquipment);
            console.log(`Seeded ${validEquipment.length} equipment records`);
        }

        return { success: true, message: 'Database seeded successfully' };
    } catch (error) {
        console.error('Error seeding database:', error);
        return { success: false, message: error.message };
    }
};
