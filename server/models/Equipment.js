const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Equipment = sequelize.define('Equipment', {
    category: {
        type: DataTypes.STRING
    },
    equipment: {
        type: DataTypes.STRING
    },
    serialNumber: {
        type: DataTypes.STRING,
        unique: true
    },
    status: {
        type: DataTypes.STRING
    },
    location: {
        type: DataTypes.STRING
    },
    notes: {
        type: DataTypes.TEXT
    }
});

module.exports = Equipment;
