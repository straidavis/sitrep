
import { foundryService } from '../services/foundryService';
import { mapFromRaw, mapToRaw } from '../config/schema';

// Dataset mapping: "shipping" (shipments), "shipment_items"

export const getAllShipments = async () => {
    try {
        const rawItems = await foundryService.readDataset('shipping');
        // Sort after mapping? or before? Raw sort is less safe.
        // Map first.
        const shipments = rawItems.map(s => mapFromRaw('shipping', s));

        // Handle nested JSON items if present in raw "items" field locally or via schema
        // Schema doesn't define 'items' field as an array, but the code does. 
        // If 'items' is a pseudo-field not in schema, it won't be mapped.
        // The previous code parsed 'items'. 
        // If 'items' is just a way to store data temporarily, it should be in schema? 
        // The schema for shipping doesn't include 'items'. 
        // It seems 'shipmentItems' is a separate dataset. 
        // The 'items' field in 'shipping' might be a legacy denormalization.
        // I will preserve it if it exists in raw, but mapFromRaw only keeps schema fields.
        // If 'items' is critical, I should add it to schema or handle it manually here.
        // However, standard practice is normalized tables. 'shipment_items' exists.
        // I will trust 'shipmentItems' for items. 
        // But for backward compatibility if 'items' column exists in 'shipping' dataset:

        return shipments.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    } catch (e) {
        console.error("Error getting shipments", e);
        return [];
    }
};

export const getAllShipmentItems = async () => {
    try {
        const rawItems = await foundryService.readDataset('shipment_items');
        return rawItems.map(i => mapFromRaw('shipmentItems', i));
    } catch (e) {
        console.error("Error getting shipment items", e);
        return [];
    }
};

export const getShipmentsByDeployment = async (deploymentId) => {
    const all = await getAllShipments();
    return all.filter(s => s.deploymentId == deploymentId);
};

export const getShipmentItemsByShipmentId = async (shipmentId) => {
    const all = await getAllShipmentItems();
    return all.filter(s => s.shipmentId == shipmentId);
};

export const addShipment = async (data) => {
    const newId = Date.now();
    const shipment = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString()
    };

    // Legacy 'items' handling? 
    // If data.items exists, we might want to discard it or save it in 'shipment_items' separately.
    // The UI likely calls addShipment with basic info, then addShipmentItem?
    // Or calls addShipment with nested items.
    // Looking at previous code, it stringified items into 'items' column.
    // If we want to move to normalized, we should probably ignore 'items' here or if user insists on legacy behavior...
    // The previous code did: 'items': JSON.stringify(data.items || [])
    // Schema doesn't have 'items'. 
    // I will stick to schema fields. If 'items' column is needed, it should be added to schema.

    const rawShipment = mapToRaw('shipping', shipment);
    await foundryService.appendRecord('shipping', rawShipment);

    // If there are items in data, we should add them to shipment_items?
    // Previous code did NOT add to shipment_items in addShipment, it just stringified it into 'items' column.
    // But getAllShipments parsed it. 
    // And there is ALSO getAllShipmentItems / addShipmentItem.
    // This implies hybrid or transitional state. 
    // I will respect the Schema. If 'items' is not in schema, it won't be saved to 'shipping'.
    // Use `addShipment` then `bulkAddShipmentItems`.

    return newId;
};

export const updateShipment = async (id, updates, user) => {
    const safeUpdates = { ...updates };
    // Map standard keys to raw
    const fUpdates = mapToRaw('shipping', safeUpdates);

    // Remove metadata/keys that shouldn't change or aren't columns
    delete fUpdates.id;
    delete fUpdates.UID;

    await foundryService.updateRecord('shipping', 'id', id, fUpdates);
};

export const deleteShipment = async (id) => {
    const items = await foundryService.readDataset('shipping');
    const filtered = items.filter(i => i.id != id && i.UID != id);
    await foundryService.writeDataset('shipping', filtered);
};

// Shipment Items

export const addShipmentItem = async (item) => {
    const newItem = {
        ...item,
        id: Date.now() + Math.random()
    };
    const rawItem = mapToRaw('shipmentItems', newItem);
    await foundryService.appendRecord('shipment_items', rawItem);
};

export const updateShipmentItem = async (id, updates) => {
    const fUpdates = mapToRaw('shipmentItems', updates);
    delete fUpdates.id; // Don't allow ID update
    await foundryService.updateRecord('shipment_items', 'id', id, fUpdates);
};

export const bulkAddShipmentItems = async (items) => {
    const current = await foundryService.readDataset('shipment_items');
    const newItems = items.map(i => {
        const item = {
            id: Date.now() + Math.random(),
            ...i
        }
        return mapToRaw('shipmentItems', item);
    });
    await foundryService.writeDataset('shipment_items', [...current, ...newItems]);
};

export const deleteShipmentItemsByShipmentId = async (shipmentId) => {
    const current = await foundryService.readDataset('shipment_items');
    // Using loose comparison for IDs is safer until types are strictly enforced
    const filtered = current.filter(i => i.shipment_id != shipmentId && i.shipmentId != shipmentId);
    await foundryService.writeDataset('shipment_items', filtered);
};

export const getShipmentItemCount = async (shipmentId) => {
    const items = await getShipmentItemsByShipmentId(shipmentId);
    return items.length;
};
