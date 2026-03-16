require('dotenv').config();
const express = require('express');
const fs = require('fs');
const { auth } = require('express-openid-connect');
const { connectQueue, getJokeFromQueue, publishModeratedJoke, CACHE_FILE } = require('./queue');

const app = express();
const PORT = process.env.PORT || 3003;
app.set('trust proxy', true);
const externalBaseUrl = process.env.AUTH0_BASE_URL || 'http://localhost:8000/moderate-api';

const config = {
  authRequired: true,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET || 'a-long-randomly-generated-string-for-session-encryption-12345',
  baseURL: externalBaseUrl,
  clientID: process.env.AUTH0_CLIENT_ID || 'w7DnLzgXwsOG8XgORbCVHH3LhGIMMsc6',
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL || 'https://dev-kxm5q64g5rqu48xu.us.auth0.com',
  getLoginState: (req, options) => {
    return { returnTo: `/moderate-api${options.returnTo || req.originalUrl }` };  },
};

app.use(auth(config));
app.use(express.static('public'));
app.use(express.json());

// Endpoint: Get Types (Reads from the Docker Volume cache as mandated by ECST)
app.get('/types', (req, res) => {
    try {
        const types = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        res.json(types);
    } catch (error) {
        res.status(500).json({ error: "Could not read types cache" });
    }
});

// Endpoint: Get a single joke to moderate
app.get('/moderate', async (req, res) => {
    try {
        const joke = await getJokeFromQueue();
        if (joke) {
            res.json(joke);
        } else {
            res.status(204).send();
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch joke" });
    }
});

// Endpoint: Submit the moderated joke
app.post('/moderated', async (req, res) => {
    const { setup, punchline, type } = req.body;
    if (!setup || !punchline || !type) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        await publishModeratedJoke({ setup, punchline, type });
        res.status(202).json({ message: "Joke approved and sent to ETL!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to process moderated joke" });
    }
});

module.exports = app;

if (require.main === module) {
    connectQueue();
    app.listen(PORT, () => {
        console.log(`Moderate Microservice running on port ${PORT}`);
        console.log(`Auth0 configured with Base URL: ${externalBaseUrl}`);
    });
}