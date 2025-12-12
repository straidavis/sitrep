import { db } from './schema';
import { format, addDays, subDays } from 'date-fns';

export const seedStoneData = async () => {
    try {
        console.log('Starting STONE deployment seed...');

        // 1. Create Deployment
        let deploymentId;
        const deploymentName = 'CGC STONE';
        const existingDeployment = await db.deployments.where('name').equals(deploymentName).first();

        if (existingDeployment) {
            deploymentId = existingDeployment.id;
            console.log('Using existing STONE deployment:', deploymentId);
        } else {
            deploymentId = await db.deployments.add({
                name: deploymentName,
                location: 'Caribbean',
                type: 'Ship',
                startDate: subDays(new Date(), 30).toISOString(),
                endDate: addDays(new Date(), 60).toISOString(),
                status: 'Active',
                description: 'Counter-Narcotics Patrol',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            console.log('Created new STONE deployment:', deploymentId);
        }

        // 2. Generate Flights
        const flights = [];
        const statuses = ['Complete', 'Complete', 'Complete', 'Complete', 'Delay', 'CNX', 'Complete'];
        const payloads = ['Eo/Ir', 'Radar', 'Relay'];
        const aircrafts = ['6501', '6502', '6503'];

        // Generate daily flights for the last 30 days
        for (let i = 30; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const numFlights = Math.floor(Math.random() * 3) + 1; // 1-3 flights per day

            for (let j = 0; j < numFlights; j++) {
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                const hours = status === 'Complete' ? (Math.random() * 4 + 1).toFixed(1) : 0;

                flights.push({
                    date: date.toISOString(),
                    status: status,
                    missionNumber: `${format(date, 'yyMMdd')}_${j + 1}`,
                    aircraftNumber: aircrafts[Math.floor(Math.random() * aircrafts.length)],
                    scheduledLaunchTime: '08:00',
                    launchTime: status === 'Complete' ? '08:00' : '',
                    recoveryTime: status === 'Complete' ? '12:00' : '',
                    hours: parseFloat(hours),
                    riskLevel: 'Low',
                    notes: `Test flight generated for STONE`,
                    payload1: payloads[Math.floor(Math.random() * payloads.length)],
                    payload2: Math.random() > 0.7 ? payloads[Math.floor(Math.random() * payloads.length)] : '',
                    weather: 'Scattered Clouds',
                    winds: '120@10',
                    oat: '85',
                    reasonForDelay: status !== 'Complete' ? 'Weather/Maintenance' : '',
                    deploymentId: deploymentId,
                    tois: Math.floor(Math.random() * 5),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }

        await db.flights.bulkAdd(flights);
        console.log(`Seeded ${flights.length} flights for STONE`);

        return { success: true, message: 'STONE data seeded successfully' };
    } catch (error) {
        console.error('Error seeding STONE data:', error);
        return { success: false, message: error.message };
    }
};
