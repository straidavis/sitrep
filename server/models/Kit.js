const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Kit = sequelize.define('Kit', {
    name: DataTypes.STRING,
    version: DataTypes.STRING,
    deploymentId: DataTypes.INTEGER
});

module.exports = Kit;
