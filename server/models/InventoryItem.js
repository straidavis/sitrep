const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryItem = sequelize.define('InventoryItem', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    deploymentId: DataTypes.STRING,
    partNumber: DataTypes.STRING,
    description: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    category: DataTypes.STRING,
    location: DataTypes.STRING,
    notes: DataTypes.TEXT,
    updatedAt: DataTypes.DATE
});

module.exports = InventoryItem;
