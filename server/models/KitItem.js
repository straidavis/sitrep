const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const KitItem = sequelize.define('KitItem', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    kitId: DataTypes.STRING,
    partNumber: DataTypes.STRING,
    description: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    actualQuantity: DataTypes.INTEGER,
    serialNumber: DataTypes.STRING,
    category: DataTypes.STRING
});

module.exports = KitItem;
