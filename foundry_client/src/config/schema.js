export const DATA_SCHEMA = {
    flights: {
        apiName: 'UscgFlights',
        fields: [
            { key: 'id', label: 'ID', type: 'text', hidden: true, sources: ['missionNumber'] },
            { key: 'date', label: 'Date', type: 'date', sources: ['date'] },
            { key: 'missionNumber', label: 'Mission #', type: 'text', sources: ['missionNumber'] },
            { key: 'aircraftNumber', label: 'Aircraft #', type: 'text', sources: ['aircraft'] },
            { key: 'scheduledLaunchTime', label: 'Scheduled', type: 'time', sources: ['scheduledLaunch'] },
            { key: 'launchTime', label: 'Launch', type: 'time', sources: ['launchTime'] },
            { key: 'recoveryTime', label: 'Recovery', type: 'time', sources: ['recoveryTime'] },
            { key: 'hours', label: 'Hours', type: 'number', sources: ['hours'] },
            { key: 'status', label: 'Status', type: 'status', sources: ['status'] },
            { key: 'updatedBy', label: 'Updated By', type: 'text', sources: ['updatedBy'] },
            { key: 'respParty', label: 'Resp. Party', type: 'text', sources: ['responsibleParty'] },

            // Logic/Detail Fields
            { key: 'notes', label: 'Notes', type: 'textarea', hidden: true, sources: ['notes'] },
            { key: 'payload1', label: 'Payload 1', type: 'text', hidden: true, sources: ['payload1'] },
            { key: 'payload2', label: 'Payload 2', type: 'text', hidden: true, sources: ['payload2'] },
            { key: 'payload3', label: 'Payload 3', type: 'text', hidden: true, sources: ['payload3'] },
            { key: 'winds', label: 'Winds', type: 'text', hidden: true, sources: ['winds'] },
            { key: 'reasonForDelay', label: 'Reason for Delay', type: 'text', hidden: true, sources: ['reasonForCancel'] },
            { key: 'abortOrDelay', label: 'Abort/Delay', type: 'text', hidden: true, sources: ['abortOrDelay'] },
            { key: 'deploymentId', label: 'Deployment ID', type: 'text', hidden: true, sources: ['deploymentId'] },
            { key: 'tois', label: 'TOIs', type: 'number', hidden: true, sources: ['tois'] },
            { key: 'contraband', label: 'Contraband', type: 'number', hidden: true, sources: ['contrabandLbs'] },
            { key: 'detainees', label: 'Detainees', type: 'number', hidden: true, sources: ['detainees'] },
            { key: 'createdAt', label: 'Created At', type: 'date', hidden: true, sources: ['createdAt'] }
        ]
    },
    deployments: {
        apiName: 'UscgDeployments',
        fields: [
            { key: 'id', label: 'ID', type: 'text', hidden: true, sources: ['deploymentId'] },
            { key: 'name', label: 'Deployment', type: 'text', sources: ['name'] },
            { key: 'location', label: 'Location', type: 'text', sources: ['location'] },
            { key: 'type', label: 'Type', type: 'text', sources: ['type'] },
            { key: 'startDate', label: 'Start Date', type: 'date', sources: ['startDate'] },
            { key: 'endDate', label: 'End Date', type: 'date', sources: ['endDate'] },
            { key: 'status', label: 'Status', type: 'status', sources: ['status'] },
            { key: 'notes', label: 'Notes', type: 'textarea', hidden: true, sources: ['notes'] },
            { key: 'lastInventoryUpdate', label: 'Last Inventory Update', type: 'date', hidden: true, sources: ['lastInventoryUpdate'] },
            { key: 'createdAt', label: 'Created At', type: 'date', hidden: true, sources: ['createdAt'] },
            { key: 'updatedAt', label: 'Updated At', type: 'date', hidden: true, sources: ['updatedAt'] },
            { key: 'userEmails', label: 'User Emails', type: 'text', hidden: true, sources: ['userEmails'] }
        ]
    },
    users: {
        apiName: 'SparkUsers',
        fields: [
            { key: 'id', label: 'User ID', type: 'text', hidden: true, sources: ['userId'] },
            { key: 'email', label: 'Email', type: 'email', sources: ['email'] },
            { key: 'username', label: 'Username', type: 'text', sources: ['username'] },
            { key: 'firstName', label: 'First Name', type: 'text', sources: ['firstName'] },
            { key: 'lastName', label: 'Last Name', type: 'text', sources: ['lastName'] },
            { key: 'role', label: 'Role', type: 'select', options: ['App.Admin', 'App.User'], sources: ['role'] },
            { key: 'assignedDeployments', label: 'Assigned Deployments', type: 'array', sources: ['assignedDeployments'] },
            // Computed fields handled by mapper or logic
            { key: 'name', label: 'Full Name', type: 'text', sources: [] }
        ]
    },
    equipment: {
        apiName: 'UscgEquipment', // Dataset Name
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['uid', 'id'] },
            { key: 'uid', label: 'UID', type: 'string', hidden: true, sources: ['uid'] },
            { key: 'serialNumber', label: 'Serial Number', type: 'string', sources: ['serialNumber'] },
            { key: 'equipment', label: 'Equipment', type: 'string', sources: ['equipmentType'] },
            { key: 'category', label: 'Category', type: 'string', sources: ['category'] },
            { key: 'status', label: 'Status', type: 'status', sources: ['status'] },
            { key: 'location', label: 'Location', type: 'string', sources: ['location'] },
            { key: 'software', label: 'Software', type: 'string', sources: ['software'] },
            { key: 'comments', label: 'Comments', type: 'textarea', sources: ['comments'] },
            { key: 'date', label: 'Date', type: 'date', sources: ['date'] },
            { key: 'deploymentId', label: 'Deployment ID', type: 'string', hidden: true, sources: ['deploymentId'] },
            { key: 'createdAt', label: 'Created At', type: 'date', hidden: true, sources: ['createdAt'] },
            { key: 'updatedAt', label: 'Updated At', type: 'date', hidden: true, sources: ['updatedAt'] },
            { key: 'lastUpdatedBy', label: 'Last Updated By', type: 'string', hidden: true, sources: ['lastUpdatedBy'] }
        ]
    },
    inventory: {
        apiName: 'UscgInventory',
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', 'UID'] },
            { key: 'deploymentId', label: 'Deployment ID', type: 'string', hidden: true, sources: ['deploymentId', 'deployment_id'] },
            { key: 'partNumber', label: 'Part Number', type: 'string', sources: ['partNumber', 'part_number', 'Part No', 'Part No.'] },
            { key: 'description', label: 'Description', type: 'string', sources: ['description', 'Description'] },
            { key: 'quantity', label: 'Quantity', type: 'number', sources: ['quantity', 'Quantity'] },
            { key: 'category', label: 'Category', type: 'string', sources: ['category', 'Category'] },
            { key: 'location', label: 'Location', type: 'string', sources: ['location', 'Location'] },
            { key: 'notes', label: 'Notes', type: 'textarea', sources: ['notes', 'Notes'] },
            { key: 'createdAt', label: 'Created At', type: 'date', hidden: true, sources: ['created_at', 'createdAt'] },
            { key: 'updatedAt', label: 'Updated At', type: 'date', hidden: true, sources: ['updated_at', 'updatedAt'] },
            { key: 'lastUpdatedBy', label: 'Last Updated By', type: 'string', hidden: true, sources: ['lastUpdatedBy', 'last_updated_by'] }
        ]
    },
    kits: {
        apiName: 'UscgKits',
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', 'UID'] },
            { key: 'name', label: 'Name', type: 'string', sources: ['name', 'Name'] },
            { key: 'version', label: 'Version', type: 'string', sources: ['version', 'Version'] },
            { key: 'deploymentId', label: 'Deployment ID', type: 'string', hidden: true, sources: ['deploymentId', 'deployment_id'] },
            { key: 'createdAt', label: 'Created At', type: 'date', hidden: true, sources: ['created_at', 'createdAt'] }
        ]
    },
    kitItems: {
        apiName: 'UscgKitItems',
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', 'UID'] },
            { key: 'kitId', label: 'Kit ID', type: 'string', hidden: true, sources: ['kitId', 'kit_id'] },
            { key: 'partNumber', label: 'Part Number', type: 'string', sources: ['partNumber', 'part_number'] },
            { key: 'description', label: 'Description', type: 'string', sources: ['description', 'Description'] },
            { key: 'quantity', label: 'Quantity', type: 'number', sources: ['quantity', 'Qty'] },
            { key: 'actualQuantity', label: 'Actual', type: 'number', sources: ['actualQuantity', 'actual_quantity'] },
            { key: 'serialNumber', label: 'Serial Number', type: 'string', sources: ['serialNumber', 'serial_number', 'S/N'] },
            { key: 'category', label: 'Category', type: 'string', sources: ['category', 'Category'] }
        ]
    },
    partsCatalog: {
        apiName: 'UscgPartsCatalog',
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', '$primaryKey', 'primaryKey', '__primaryKey'] },
            { key: 'partNumber', label: 'Part Number', type: 'string', sources: ['partNumber', 'part_number'] },
            { key: 'description', label: 'Description', type: 'string', sources: ['description', 'Description'] },
            { key: 'supplier', label: 'Supplier', type: 'string', sources: ['supplier', 'Supplier'] },
            { key: 'cost', label: 'Cost', type: 'number', sources: ['cost', 'Cost', 'price'] },
            { key: 'category', label: 'Category', type: 'string', sources: ['category', 'Category'] }
        ]
    },
    partsUtilization: {
        apiName: 'UscgPartsUtilization',
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', 'UID'] },
            { key: 'deploymentId', label: 'Deployment ID', type: 'string', hidden: true, sources: ['deploymentId', 'deployment_id'] },
            { key: 'partNumber', label: 'Part Number', type: 'string', sources: ['partNumber', 'part_number'] },
            { key: 'description', label: 'Description', type: 'string', sources: ['description', 'Description'] },
            { key: 'quantity', label: 'Quantity', type: 'number', sources: ['quantity', 'Quantity'] },
            { key: 'type', label: 'Type', type: 'status', sources: ['type', 'Type'] },
            { key: 'date', label: 'Date', type: 'date', sources: ['date', 'Date'] },
            { key: 'remarks', label: 'Remarks', type: 'textarea', sources: ['remarks', 'Remarks'] }
        ]
    },
    serviceBulletins: {
        apiName: 'UscgServiceBulletins',
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', 'UID', 'sb_id'] },
            { key: 'sbNumber', label: 'SB Number', type: 'string', sources: ['sbNumber', 'sb_number', 'sb_id'] },
            { key: 'title', label: 'Title', type: 'string', sources: ['title', 'Title'] },
            { key: 'description', label: 'Description', type: 'textarea', sources: ['description', 'Description'] },
            { key: 'complianceLevel', label: 'Compliance Level', type: 'status', sources: ['complianceLevel', 'compliance_level'] },
            { key: 'dateIssued', label: 'Date Issued', type: 'date', sources: ['dateIssued', 'date_issued'] },
            { key: 'deadlineDate', label: 'Deadline', type: 'date', sources: ['deadlineDate', 'deadline_date'] },
            { key: 'status', label: 'Status', type: 'status', sources: ['status', 'Status'] },
            { key: 'deploymentId', label: 'Deployment ID', type: 'string', hidden: true, sources: ['deploymentId', 'deployment_id'] },
            { key: 'link', label: 'Link', type: 'string', sources: ['link', 'Link'] },
            { key: 'notes', label: 'Notes', type: 'textarea', sources: ['notes', 'Notes'] },
            { key: 'applicableIds', label: 'Applicable Deployments', type: 'json', sources: ['applicableIds', 'applicable_deployment_ids'] },
            { key: 'effectedEquipment', label: 'Effected Equipment', type: 'json', sources: ['effectedEquipment', 'effected_equipment'] },
            { key: 'createdAt', label: 'Created At', type: 'date', hidden: true, sources: ['createdAt', 'created_at'] },
            { key: 'updatedAt', label: 'Updated At', type: 'date', hidden: true, sources: ['updatedAt', 'last_updated_by'] }
        ]
    },
    shipmentItems: {
        apiName: 'UscgShipmentItems',
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', 'UID'] },
            { key: 'shipmentId', label: 'Shipment ID', type: 'string', hidden: true, sources: ['shipmentId', 'shipment_id'] },
            { key: 'partNumber', label: 'Part Number', type: 'string', sources: ['partNumber', 'part_number'] },
            { key: 'description', label: 'Description', type: 'string', sources: ['description', 'Description'] },
            { key: 'quantity', label: 'Quantity', type: 'number', sources: ['quantity', 'Quantity'] },
            { key: 'serialNumber', label: 'Serial Number', type: 'string', sources: ['serialNumber', 'serial_number'] },
            { key: 'receivedDate', label: 'Received Date', type: 'date', sources: ['receivedDate', 'received_date'] }
        ]
    },
    shipping: {
        apiName: 'UscgShipping',
        fields: [
            { key: 'id', label: 'ID', type: 'string', hidden: true, sources: ['id', 'UID'] },
            { key: 'uid', label: 'UID', type: 'string', sources: ['uid', 'UID'] },
            { key: 'deploymentId', label: 'Deployment ID', type: 'string', hidden: true, sources: ['deploymentId', 'deployment_id'] },
            { key: 'trackingNumber', label: 'Tracking #', type: 'string', sources: ['trackingNumber', 'tracking_number'] },
            { key: 'carrier', label: 'Carrier', type: 'string', sources: ['carrier', 'Carrier'] },
            { key: 'status', label: 'Status', type: 'status', sources: ['status', 'Status'] },
            { key: 'orderDate', label: 'Order Date', type: 'date', sources: ['orderDate', 'order_date'] },
            { key: 'shipDate', label: 'Ship Date', type: 'date', sources: ['shipDate', 'ship_date'] },
            { key: 'hostReceivedDate', label: 'Host Received', type: 'date', sources: ['hostReceivedDate', 'host_received_date'] },
            { key: 'siteReceivedDate', label: 'Site Received', type: 'date', sources: ['siteReceivedDate', 'site_received_date'] },
            { key: 'notes', label: 'Notes', type: 'textarea', sources: ['notes', 'Notes'] }
        ]
    }
};

/**
 * Maps raw data object to Application Schema
 */
export const mapFromRaw = (schemaKey, raw) => {
    const schema = DATA_SCHEMA[schemaKey];
    if (!schema) {
        console.warn(`[Schema] No schema definition for: ${schemaKey}`);
        return raw;
    }

    const mapped = {};
    // Handle both Flat (LoadObjects) and Nested (Search) formats
    const sourceData = raw.properties ? raw.properties : raw;

    schema.fields.forEach(field => {
        let val;
        // Try all source keys
        for (const source of field.sources) {
            if (sourceData[source] !== undefined && sourceData[source] !== null) {
                val = sourceData[source];
                break;
            }
        }

        // Formatting / Safe Defaults
        if (field.type === 'number') {
            mapped[field.key] = val !== undefined ? parseFloat(val) : 0;
        } else if (field.type === 'text' || field.type === 'textarea') {
            mapped[field.key] = val !== undefined ? String(val).trim() : '';
        } else if (field.type === 'json' && typeof val === 'string') {
            try {
                mapped[field.key] = val ? JSON.parse(val) : [];
            } catch (e) {
                console.warn(`[Schema] Failed to parse JSON for ${field.key}`, e);
                mapped[field.key] = [];
            }
        } else {
            mapped[field.key] = val !== undefined ? val : null;
        }

        // Special case: existing logic used '0' fallback for some numbers
    });

    // Ensure ID exists
    if (!mapped.id) {
        mapped.id = raw.$primaryKey || raw.__primaryKey || raw.primaryKey || raw.id;
    }

    return mapped;
};

/**
 * Maps Application Object back to Raw (Ontology/Dataset) format
 * Uses the FIRST source key as the write target (convention)
 */
export const mapToRaw = (schemaKey, appData) => {
    const schema = DATA_SCHEMA[schemaKey];
    if (!schema) throw new Error(`Schema '${schemaKey}' not found.`);

    const raw = {};
    schema.fields.forEach(field => {
        if (appData[field.key] !== undefined) {
            // Use the first source as the primary key for writing (e.g. 'mission_number' instead of 'missionNumber')
            const targetKey = field.sources[0];
            if (!targetKey) return; // Skip if no write source defined (virtual field)
            let val = appData[field.key];

            // Auto-Format Dates for Ontology (YYYY-MM-DD)
            if (field.type === 'date' && val) {
                // Ensure we send YYYY-MM-DD string, strip time if present
                const dateStr = String(val);
                if (dateStr.includes('T')) {
                    val = dateStr.split('T')[0];
                }
            }

            // Validating String Types (Arrays not allowed for String parameters)
            if ((field.type === 'text' || field.type === 'textarea') && Array.isArray(val)) {
                val = val.join(', ');
            }

            raw[targetKey] = val;

            // Handle JSON fields (Stringify for storage if backend expects string)
            if (field.type === 'json' && typeof val === 'object') {
                raw[targetKey] = JSON.stringify(val);
            }
        }
    });

    return raw;
};

export const getTableHeaders = (schemaKey) => {
    const schema = DATA_SCHEMA[schemaKey];
    if (!schema) return [];
    return schema.fields.filter(f => !f.hidden);
};
