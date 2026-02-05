const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
console.log(`[DB Config] Environment: ${environment}`);
console.log(`[DB Config] Host: ${process.env.DB_HOST}`);
console.log(`[DB Config] Database: ${process.env.DB_NAME}`);

const db = knex(knexConfig[environment]);

module.exports = db;
