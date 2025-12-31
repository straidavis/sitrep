const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Kit = sequelize.define('Kit', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    name: DataTypes.STRING,
    version: DataTypes.STRING,
    deploymentId: DataTypes.STRING
});

module.exports = Kit;
