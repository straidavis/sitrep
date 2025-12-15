const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryItem = sequelize.define('InventoryItem', {
    partNumber: DataTypes.STRING,
    description: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    category: DataTypes.STRING,
    location: DataTypes.STRING,
    notes: DataTypes.TEXT,
    deploymentId: DataTypes.INTEGER
});

module.exports = InventoryItem;
