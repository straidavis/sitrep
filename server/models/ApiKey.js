const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ApiKey = sequelize.define('ApiKey', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    key: {
        type: DataTypes.STRING, // Store hashed keys in production, but prompt implies simple match for now or matching specifically generated keys
        allowNull: false,
        unique: true
    },
    status: {
        type: DataTypes.ENUM('Active', 'Revoked'),
        defaultValue: 'Active'
    }
});

module.exports = ApiKey;
