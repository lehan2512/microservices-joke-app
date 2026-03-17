/**
 * @file errors.js
 * @description Custom error classes for the Joke API, providing specific context for database and resource failures.
 */

/**
 * Represents an error that occurs during database operations.
 * @extends Error
 */
class DatabaseError extends Error {
    /**
     * Creates a new DatabaseError.
     * @param {string} message - The error message.
     * @param {Error} [originalError=null] - The original error that caused this failure.
     */
    constructor(message, originalError = null) {
        super(message);
        this.name = 'DatabaseError';
        this.originalError = originalError;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DatabaseError);
        }
    }
}

/**
 * Represents an error when a requested resource is not found.
 * @extends Error
 */
class NotFoundError extends Error {
    /**
     * Creates a new NotFoundError.
     * @param {string} message - The error message.
     */
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NotFoundError);
        }
    }
}

module.exports = { DatabaseError, NotFoundError };