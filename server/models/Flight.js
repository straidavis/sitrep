const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Flight = sequelize.define('Flight', {
    date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    missionNumber: {
        type: DataTypes.STRING,
    },
    aircraftNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    launcher: {
        type: DataTypes.STRING
    },
    numberOfLaunches: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    deploymentId: {
        type: DataTypes.INTEGER
    },
    launchTime: {
        type: DataTypes.STRING
    },
    recoveryTime: {
        type: DataTypes.STRING
    },
    hours: {
        type: DataTypes.FLOAT
    },
    status: {
        type: DataTypes.STRING
    },
    notes: {
        type: DataTypes.TEXT
    }
});

module.exports = Flight;
