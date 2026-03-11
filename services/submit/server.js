require('dotenv').config();
const express = require('express');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const { connectQueue, publishJoke, CACHE_FILE } = require('./queue');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.static('public'));

// Setup Swagger Docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Start RabbitMQ Connection
connectQueue();

// Endpoint: Get Types (Reads purely from local cache)
app.get('/types', (req, res) => {
    try {
        const types = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        res.json(types);
    } catch (error) {
        res.status(500).json({ error: "Could not read types cache" });
    }
});

// Endpoint: Submit new joke
app.post('/submit', async (req, res) => {
    const { setup, punchline, type } = req.body;
    
    if (!setup || !punchline || !type) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        await publishJoke({ setup, punchline, type });
        res.status(202).json({ message: "Joke submitted for moderation!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to queue joke" });
    }
});

app.listen(PORT, () => {
    console.log(`Submit Microservice running on port ${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});