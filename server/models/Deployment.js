const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Deployment = sequelize.define('Deployment', {
    deploymentId: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    name: DataTypes.STRING,
    location: DataTypes.STRING,
    type: DataTypes.STRING,
    startDate: DataTypes.DATE,
    endDate: DataTypes.DATE,
    status: DataTypes.STRING,
    notes: DataTypes.TEXT
});

module.exports = Deployment;
