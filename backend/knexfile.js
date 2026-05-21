require('dotenv').config();

const isTrue = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true';
};

const buildProductionSsl = () => {
  if (!isTrue(process.env.DB_SSL, true)) {
    return undefined;
  }

  const ssl = {
    rejectUnauthorized: isTrue(process.env.DB_SSL_REJECT_UNAUTHORIZED, true)
  };

  if (process.env.DB_SSL_CA) ssl.ca = process.env.DB_SSL_CA;
  if (process.env.DB_SSL_CERT) ssl.cert = process.env.DB_SSL_CERT;
  if (process.env.DB_SSL_KEY) ssl.key = process.env.DB_SSL_KEY;

  return ssl;
};

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'zync_erp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || ''
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './database/seeds'
    }
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: buildProductionSsl()
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './database/seeds'
    }
  }
};
