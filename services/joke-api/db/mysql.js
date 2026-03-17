/**
 * @file mysql.js
 * @description MySQL repository implementation for joke data access.
 */
const mysql = require('mysql2/promise');
const { DatabaseError } = require('../errors');
const config = require('../config');

/**
 * Repository class for MySQL operations.
 */
class MySQLRepository {
    /**
     * Creates an instance of MySQLRepository.
     * Initializes the MySQL connection pool.
     */
    constructor() {
        this.initPool();
    }

    /**
     * Initializes the MySQL connection pool and sets up error handling for the pool.
     * @throws {DatabaseError} If pool initialization fails.
     */
    initPool() {
        try {
            this.pool = mysql.createPool(config.mysql);

            // Container lifecycle management
            this.pool.on('error', (err) => {
                console.error('CRITICAL: API Database pool error:', err.message);
                if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal) {
                    console.warn("MySQL connection lost. Attempting to heal connection pool...");
                    this.refreshPool();
                }
            });
        } catch (err) {
            throw new DatabaseError('Failed to initialize MySQL connection pool', err);
        }
    }

    /**
     * Refreshes the connection pool by closing the old one and creating a new one.
     * @returns {Promise<void>}
     */
    async refreshPool() {
        try {
            if (this.pool) {
                await this.pool.end();
            }
        } catch (e) {
            // Ignore errors during cleanup of a dead pool
        }
        this.initPool();
    }

    /**
     * Fetches a joke type by its name (case-insensitive).
     * @param {string} name - The name of the type to find.
     * @returns {Promise<Object|null>} The type record (id, name) or null if not found.
     * @throws {DatabaseError} If the database query fails.
     */
    async getTypeByName(name) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT id, name FROM types WHERE LOWER(name) = LOWER(?) LIMIT 1', 
                [name]
            );
            return rows[0] || null;
        } catch (err) {
            throw new DatabaseError(`Failed to fetch type by name: ${name}`, err);
        }
    }

    /**
     * Gets the total count of jokes, optionally filtered by type.
     * @param {Object} [typeRow=null] - The type record containing the id to filter by.
     * @returns {Promise<number>} The number of jokes found.
     * @throws {DatabaseError} If the database query fails.
     */
    async getJokeCount(typeRow = null) {
        try {
            let query = 'SELECT COUNT(*) as cnt FROM jokes';
            let params = [];
            
            if (typeRow) {
                query += ' WHERE type_id = ?';
                params.push(typeRow.id);
            }
            
            const [[{ cnt }]] = await this.pool.execute(query, params);
            return cnt || 0;
        } catch (err) {
            throw new DatabaseError('Failed to get joke count', err);
        }
    }

    /**
     * Retrieves a single joke by its offset from the start of the table (or filtered list).
     * @param {Object} [typeRow=null] - The type record containing the id to filter by.
     * @param {number|string} [offset=0] - The zero-based index of the joke to retrieve.
     * @returns {Promise<Object|null>} The joke record (setup, punchline, type) or null if not found.
     * @throws {DatabaseError} If the database query fails.
     */
    async getJokeByOffset(typeRow = null, offset = 0) {
        try {
            let query = 'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id';
            let params = [];
            
            if (typeRow) {
                query += ' WHERE j.type_id = ?';
                params.push(typeRow.id);
            }
            
            query += ' ORDER BY j.id LIMIT 1 OFFSET ?';
            params.push(offset.toString()); 

            const [rows] = await this.pool.execute(query, params);
            return rows[0] || null;
        } catch (err) {
            throw new DatabaseError(`Failed to fetch joke at offset ${offset}`, err);
        }
    }

    /**
     * Retrieves all available joke types from the database.
     * @returns {Promise<Array<string>>} A list of joke type names.
     * @throws {DatabaseError} If the database query fails.
     */
    async getTypes() {
        try {
            const [rows] = await this.pool.execute('SELECT name FROM types');
            return rows.map(r => r.name);
        } catch (err) {
            throw new DatabaseError('Failed to fetch types list', err);
        }
    }
}

module.exports = MySQLRepository;