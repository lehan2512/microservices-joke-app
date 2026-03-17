/**
 * @file server.js
 * @description Express server for the Joke Submission microservice.
 * Provides public endpoints for users to submit new jokes and retrieve available joke types.
 * Integrated with Swagger for API documentation.
 */

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const { connectQueue, publishJoke, CACHE_FILE } = require('./queue');

const app = express();
const PORT = process.env.PORT || 3200;

app.use(express.json());
app.use(express.static('public'));

/**
 * Swagger Documentation Route
 */
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

/**
 * GET /types
 * @description Retrieves the current list of available joke types from the local cache.
 * @name GetTypes
 * @route {GET} /types
 */
app.get('/types', (req, res) => {
    try {
        const types = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        res.json(types);
    } catch (error) {
        res.status(500).json({ error: "Could not read types cache" });
    }
});

/**
 * POST /submit
 * @description Submits a new joke for moderation.
 * @name SubmitJoke
 * @route {POST} /submit
 * @body {string} setup - Joke setup.
 * @body {string} punchline - Joke punchline.
 * @body {string} type - Joke type.
 */
app.post('/submit', async (req, res) => {
    const { setup, punchline, type } = req.body;
    if (!setup || !punchline || !type) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        await publishJoke({ setup, punchline, type });
        res.status(202).json({ message: "Joke submitted for moderation!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to submit joke" });
    }
});

module.exports = app;

if (require.main === module) {
    connectQueue();
    app.listen(PORT, () => {
        console.log(`Submit Microservice running on port ${PORT}`);
    });
}
