const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Deployment = sequelize.define('Deployment', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING
    },
    startDate: {
        type: DataTypes.DATEONLY
    },
    endDate: {
        type: DataTypes.DATEONLY
    },
    location: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.STRING
    }
});

module.exports = Deployment;
