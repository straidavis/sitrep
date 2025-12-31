const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Equipment = sequelize.define('Equipment', {
    uid: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    serialNumber: DataTypes.STRING,
    equipmentType: DataTypes.STRING,
    category: DataTypes.STRING,
    status: DataTypes.STRING,
    location: DataTypes.STRING,
    software: DataTypes.STRING,
    comments: DataTypes.TEXT,
    deploymentId: DataTypes.STRING
});

module.exports = Equipment;
