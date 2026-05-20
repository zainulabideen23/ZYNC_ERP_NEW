const knex = require('knex');
const knexConfig = require('../../knexfile');
const { getRequestTransaction } = require('./requestContext');

const environment = process.env.NODE_ENV || 'development';
console.log(`[DB Config] Environment: ${environment}`);
console.log(`[DB Config] Host: ${process.env.DB_HOST}`);
console.log(`[DB Config] Database: ${process.env.DB_NAME}`);

const baseDb = knex(knexConfig[environment]);

const getExecutor = () => getRequestTransaction() || baseDb;

const db = new Proxy(
	function databaseProxy(...args) {
		return getExecutor()(...args);
	},
	{
		apply(_target, _thisArg, args) {
			return getExecutor()(...args);
		},

		get(_target, prop) {
			if (prop === '__rawDb') return baseDb;

			const executor = getExecutor();
			const value = executor[prop];
			if (typeof value === 'function') return value.bind(executor);
			return value;
		}
	}
);

module.exports = db;
