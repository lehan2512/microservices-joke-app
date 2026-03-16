/**
 * Database and Application Configuration
 * Centralizes environment variables to prevent hardcoded secrets and limits.
 */
require('dotenv').config();

module.exports = {
    dbType: process.env.DB_TYPE || 'MYSQL',
    mysql: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'jokes_db',
        waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS !== 'false',
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
        queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10) || 0
    },
    mongo: {
        uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
        dbName: process.env.DB_NAME || 'jokes_db'
    }
};