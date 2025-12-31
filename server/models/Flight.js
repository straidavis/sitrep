const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Flight = sequelize.define('Flight', {
    missionNumber: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    date: DataTypes.DATE,
    aircraftNumber: DataTypes.STRING,
    scheduledLaunchTime: DataTypes.STRING,
    launchTime: DataTypes.STRING,
    recoveryTime: DataTypes.STRING,
    hours: DataTypes.FLOAT,
    status: DataTypes.STRING,
    updatedBy: DataTypes.STRING,
    deploymentId: DataTypes.STRING,
    // Add other fields from schema if needed, keeping it loose for now
    notes: DataTypes.TEXT,
    payload1: DataTypes.STRING,
    payload2: DataTypes.STRING,
    payload3: DataTypes.STRING,
    winds: DataTypes.STRING,
    reasonForDelay: DataTypes.STRING,
    abortOrDelay: DataTypes.STRING
});

module.exports = Flight;
