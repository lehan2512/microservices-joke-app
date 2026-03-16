/**
 * Database Entry Point / Factory
 * Acts as the injection container, providing the fully assembled Service 
 * to the Express application without requiring any changes to server.js.
 */
const config = require('./config');
const MySQLRepository = require('./db/mysql');
const MongoRepository = require('./db/mongo');
const JokeService = require('./service');

let repository;

if (config.dbType === 'MONGO') {
    repository = new MongoRepository();
} else {
    repository = new MySQLRepository();
}

// Inject the chosen repository into the service layer
const jokeService = new JokeService(repository);

// Export the service so server.js can consume it seamlessly
module.exports = jokeService;