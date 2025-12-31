const Sequelize = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_PATH || './sitrep.sqlite',
    logging: false
});

module.exports = sequelize;
