import { db } from './schema';

/**
 * Get missing kit items for specified deployments
 * @param {Array<number>} deploymentIds 
 * @returns {Promise<Array>}
 */
export const getMissingKitItems = async (deploymentIds = null) => {
    try {
        let kits = [];
        if (deploymentIds && deploymentIds.length > 0) {
            // Dexie 'anyOf' is useful here
            const ids = deploymentIds.map(id => parseInt(id));
            kits = await db.kits.where('deploymentId').anyOf(ids).toArray();
        } else {
            kits = await db.kits.toArray();
        }

        if (kits.length === 0) return [];

        const kitIds = kits.map(k => k.id);
        const allItems = await db.kitItems.where('kitId').anyOf(kitIds).toArray();

        // 1. Filter for missing items
        // 2. Map to include Kit Name and Deployment Name (need to fetch deployments if not passed)

        // We know deploymentIds, but not names. Let's fetch deployments map for naming if needed.
        // Actually, just Kit Name is probably enough? Or "Deployment - Kit"?
        // Let's get deployment map just in case.
        const deployments = await db.deployments.where('id').anyOf(kits.map(k => k.deploymentId)).toArray();
        const depMap = deployments.reduce((acc, d) => {
            acc[d.id] = d.name;
            return acc;
        }, {});

        const kitMap = kits.reduce((acc, k) => {
            acc[k.id] = { name: k.name, deploymentName: depMap[k.deploymentId] };
            return acc;
        }, {});

        const missing = allItems
            .filter(item => {
                const required = parseFloat(item.quantity) || 0;
                const actual = parseFloat(item.actualQuantity) || 0;
                return actual < required;
            })
            .map(item => ({
                ...item,
                kitName: kitMap[item.kitId]?.name,
                deploymentName: kitMap[item.kitId]?.deploymentName,
                missingQuantity: (parseFloat(item.quantity) || 0) - (parseFloat(item.actualQuantity) || 0)
            }));

        return missing;

    } catch (error) {
        console.error('Error fetching missing kit items:', error);
        return [];
    }
};
