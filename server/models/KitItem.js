const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const KitItem = sequelize.define('KitItem', {
    kitId: DataTypes.INTEGER,
    partNumber: DataTypes.STRING,
    description: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    category: DataTypes.STRING,
    serialNumber: DataTypes.STRING,
    actualQuantity: DataTypes.INTEGER
});

module.exports = KitItem;
