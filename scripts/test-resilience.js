#!/usr/bin/env node
/**
 * System-Wide Resilience Test
 */

const { spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const JOKE_API_URL = 'http://localhost:3001/joke/any?count=100';
const DB_TYPE = 'MYSQL'; // Hardcode for this test to match docker-compose profiles
const DB_SERVICE = 'mysql';

function runCommand(command, args) {
    console.log(`> ${command} ${args.join(' ')}`);
    return spawnSync(command, args, { 
        stdio: 'inherit', 
        shell: true,
        env: { ...process.env, DB_TYPE: DB_TYPE }
    });
}

async function getJokes() {
    return new Promise((resolve) => {
        const req = http.get(JOKE_API_URL, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: body });
                }
            });
        });
        req.on('error', (e) => resolve({ status: 500, body: e.message }));
    });
}

async function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runResilienceTests() {
    console.log(`\n=== Starting Resilience Tests (DB: ${DB_TYPE}) ===`);

    // 1. Setup
    console.log("\n[1/4] Ensuring environment is up...");
    // Pass DB_TYPE to ensure containers are built/started with MYSQL
    runCommand('docker-compose', ['--profile', DB_SERVICE, 'up', '-d', '--force-recreate']);
    console.log("Waiting for services to initialize (30s)...");
    await wait(30000);

    // Verify DB_TYPE in one of the containers
    console.log("Verifying container configuration...");
    spawnSync('docker', ['exec', 'joke_api', 'env'], { stdio: 'inherit', shell: true });

    // 2. Database Failure & Queue Safety
    console.log("\n[2/4] Testing Database Failure & Queue Safety...");
    console.log(`Stopping ${DB_SERVICE} database...`);
    runCommand('docker-compose', ['stop', DB_SERVICE]);
    
    const timestamp = Date.now();
    const setup = "Resilience Test Joke " + timestamp;
    const punchline = "I survived the outage!";
    const type = "tech";
    
    console.log("Publishing a joke to RabbitMQ while DB is offline...");
    const publishScript = path.join(__dirname, 'publish-moderated.js');
    runCommand('node', [`"${publishScript}"`, `"${setup}"`, `"${punchline}"`, `"${type}"`]);

    // 3. Recovery
    console.log(`\n[3/4] Testing Recovery...`);
    console.log(`Starting ${DB_SERVICE} database...`);
    runCommand('docker-compose', ['start', DB_SERVICE]);
    
    console.log("Waiting for ETL to detect DB and reprocess (45s)...");
    await wait(45000);

    let jokes = await getJokes();
    let found = Array.isArray(jokes.body) && jokes.body.some(j => j.setup === setup);
    
    if (found) {
        console.log("SUCCESS: Joke processed correctly after DB recovery!");
    } else {
        console.log("RETRY: Joke not found yet, waiting another 30s...");
        await wait(30000);
        jokes = await getJokes();
        found = Array.isArray(jokes.body) && jokes.body.some(j => j.setup === setup);
        if (found) {
            console.log("SUCCESS: Joke found after extended wait.");
        } else {
            console.error("FAILURE: Joke was lost or not processed.");
            console.log("API Response:", JSON.stringify(jokes.body));
            console.log("\n--- ETL LOGS ---");
            runCommand('docker', ['logs', 'joke_etl', '--tail', '20']);
            console.log("\n--- API LOGS ---");
            runCommand('docker', ['logs', 'joke_api', '--tail', '20']);
        }
    }

    // 4. Volume Persistence
    console.log("\n[4/4] Testing Container Persistence (Volumes)...");
    console.log(`Restarting ${DB_SERVICE} container...`);
    runCommand('docker-compose', ['restart', DB_SERVICE]);
    await wait(20000);

    jokes = await getJokes();
    found = Array.isArray(jokes.body) && jokes.body.some(j => j.setup === setup);
    
    if (found) {
        console.log("SUCCESS: Data survived container restart!");
    } else {
        console.error("FAILURE: Data lost after container restart.");
    }

    console.log("\n=== Resilience Tests Complete ===\n");
}

runResilienceTests().catch(console.error);
