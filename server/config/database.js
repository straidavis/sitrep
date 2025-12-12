require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const useAzureDb = process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASS;

let sequelize;

if (useAzureDb) {
    console.log('Using Azure SQL Database (MSSQL)');
    sequelize = new Sequelize(
        process.env.DB_NAME || 'sitrep_db',
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            dialect: 'mssql',
            dialectOptions: {
                options: {
                    encrypt: true, // Required for Azure SQL
                    trustServerCertificate: false // Change to true if using self-signed certs (dev)
                }
            },
            logging: false,
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            }
        }
    );
} else {
    console.log('Using Local SQLite Database');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '../database.sqlite'), // Moved up to root of server dir
        logging: false
    });
}

module.exports = sequelize;
