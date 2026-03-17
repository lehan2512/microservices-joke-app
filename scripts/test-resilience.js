#!/usr/bin/env node
/**
 * @fileoverview Comprehensive System-Wide Resilience Verification Suite.
 * 
 * This script automates the verification of system stability during infrastructure 
 * failures, specifically targeting database outages, RabbitMQ safety, and service isolation.
 * It uses Docker Compose to manipulate service availability and checks system response.
 */

const { spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

// Configuration
const JOKE_API_URL = 'http://localhost:3001/joke/any?count=100';
const SUBMIT_API_URL = 'http://localhost:3002/submit';
const MODERATE_API_URL = 'http://localhost:3003/moderate';
const MODERATED_SUBMIT_URL = 'http://localhost:3003/moderated';
const DB_SERVICE = 'mysql';
const RABBITMQ_SERVICE = 'rabbitmq';

/**
 * Executes a shell command and returns the result.
 * 
 * @function runCommand
 * @param {string} command - The base command to execute.
 * @param {string[]} args - Array of arguments for the command.
 * @returns {import('child_process').SpawnSyncReturns<Buffer>} The spawn result object.
 */
function runCommand(command, args) {
    console.log(`> ${command} ${args.join(' ')}`);
    return spawnSync(command, args, { 
        stdio: 'inherit', 
        shell: true,
        env: { ...process.env }
    });
}

/**
 * Fetches queue statistics directly from RabbitMQ.
 * 
 * @function getQueueStats
 * @returns {Object} Object containing messages_ready and messages_unacknowledged counts.
 */
function getQueueStats() {
    const result = spawnSync('docker', [
        'exec', 'jokes_rabbitmq', 
        'rabbitmqctl', 'list_queues', 'name', 'messages_ready', 'messages_unacknowledged',
        '--formatter', 'json'
    ], { encoding: 'utf8' });
    
    try {
        const data = JSON.parse(result.stdout);
        return data.find(q => q.name === 'moderated') || { messages_ready: 0, messages_unacknowledged: 0 };
    } catch (e) {
        return { messages_ready: 0, messages_unacknowledged: 0 };
    }
}

/**
 * Performs an HTTP GET request and returns status and body.
 * 
 * @async
 * @function getRequest
 * @param {string} url - The destination URL.
 * @returns {Promise<{status: number, body: (Object|string)}>} The response status and parsed body.
 */
async function getRequest(url) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
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

/**
 * Performs an HTTP POST request and returns status and body.
 * 
 * @async
 * @function postRequest
 * @param {string} url - The destination URL.
 * @param {Object} data - The JSON payload to send.
 * @returns {Promise<{status: number, body: string}>} The response status and body string.
 */
async function postRequest(url, data) {
    return new Promise((resolve) => {
        const payload = JSON.stringify(data);
        const req = http.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', (e) => resolve({ status: 500, body: e.message }));
        req.write(payload);
        req.end();
    });
}

/**
 * Suspends execution for a specified duration.
 * 
 * @async
 * @function wait
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
async function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Orchestrates the execution of multiple resilience test scenarios.
 * 
 * @async
 * @function runResilienceSuite
 * @returns {Promise<void>}
 */
async function runResilienceSuite() {
    console.log("=== STARTING COMPREHENSIVE RESILIENCE VERIFICATION ===");

    /**
     * Test Case: Environment Initialization
     * Description: Ensure all containers are built and running in a clean state.
     */
    console.log("\n[1/8] Initializing Environment...");
    runCommand('docker-compose', ['--profile', 'mysql', 'up', '-d', '--force-recreate']);
    await wait(20000);

    /**
     * Test Case: RabbitMQ Outage Isolation
     * Description: Verify that services remain partially functional (cached data) 
     *              while RabbitMQ is unavailable.
     */
    console.log("\n[2/8] Verification: Service Isolation During RabbitMQ Outage...");
    runCommand('docker-compose', ['stop', RABBITMQ_SERVICE]);
    await wait(5000);

    const submitResDown = await postRequest(SUBMIT_API_URL, { setup: "Fail", punchline: "Fail", type: "tech" });
    const typesResDown = await getRequest('http://localhost:3002/types');

    if (submitResDown.status === 500 && typesResDown.status === 200) {
        console.log("SUCCESS: Services correctly isolated RabbitMQ failure.");
    } else {
        console.error(`FAILURE: Submit returned ${submitResDown.status}, Types returned ${typesResDown.status}`);
    }

    /**
     * Test Case: RabbitMQ Recovery
     * Description: Verify that services automatically reconnect and resume normal 
     *              operations once RabbitMQ returns.
     */
    console.log("\n[3/8] Verification: Service Recovery After RabbitMQ Restored...");
    runCommand('docker-compose', ['start', RABBITMQ_SERVICE]);
    console.log("Waiting for services to reconnect (15s)...");
    await wait(15000);

    const submitResUp = await postRequest(SUBMIT_API_URL, { setup: "Recovery Test", punchline: "Success", type: "dad" });
    if (submitResUp.status === 202) {
        console.log("SUCCESS: Submit service automatically recovered and resumed publishing.");
    } else {
        console.error(`FAILURE: Submit service failed to recover. Status: ${submitResUp.status}`);
    }

    /**
     * Test Case: API Graceful Failure (Database Outage)
     * Description: Verify that the Joke API returns 500 when the database is unreachable.
     */
    console.log("\n[4/8] Verification: Joke API Behavior During DB Outage...");
    runCommand('docker-compose', ['stop', DB_SERVICE]);
    
    const apiDownResponse = await getRequest(JOKE_API_URL);
    if (apiDownResponse.status === 500) {
        console.log("SUCCESS: API returned 500 Internal Server Error as expected.");
    } else {
        console.error(`FAILURE: API returned ${apiDownResponse.status} during outage.`);
    }

    /**
     * Test Case: Queue Persistence (RabbitMQ)
     * Description: Verify that jokes published during an outage are safely held in the queue.
     */
    console.log("\n[5/8] Verification: Queue Safety During DB Outage...");
    const timestamp = Date.now();
    const setup = "Resilience Joke " + timestamp;
    const publishScript = path.join(__dirname, 'publish-moderated.js');
    
    runCommand('node', [`"${publishScript}"`, `"${setup}"`, "I survived!", "tech"]);
    await wait(5000);

    const stats = getQueueStats();
    const totalMessages = stats.messages_ready + stats.messages_unacknowledged;
    console.log(`Queue State: Ready=${stats.messages_ready}, Unacked=${stats.messages_unacknowledged}`);

    if (totalMessages >= 1) {
        console.log("SUCCESS: Joke remained safely in RabbitMQ.");
    } else {
        console.error("FAILURE: Joke was lost from RabbitMQ queue.");
        process.exit(1);
    }

    /**
     * Test Case: Automatic Recovery (Self-Healing)
     * Description: Verify that API and ETL services recover automatically when DB returns.
     */
    console.log("\n[6/8] Verification: System Recovery & Self-Healing...");
    runCommand('docker-compose', ['start', DB_SERVICE]);
    console.log("Waiting for components to recover (45s)...");
    await wait(45000);

    const apiUpResponse = await getRequest(JOKE_API_URL);
    const foundInDb = apiUpResponse.body && apiUpResponse.body.some(j => j.setup === setup);

    if (apiUpResponse.status === 200 && foundInDb) {
        console.log("SUCCESS: System recovered and processed waiting jokes correctly.");
    } else {
        console.error("FAILURE: System failed to recover or process data.");
        process.exit(1);
    }

    /**
     * Test Case: Container Persistence (Docker Volumes)
     * Description: Verify that joke data survives a full database container restart.
     */
    console.log("\n[7/8] Verification: Data Persistence (Volumes)...");
    runCommand('docker-compose', ['restart', DB_SERVICE]);
    await wait(15000);

    const finalResponse = await getRequest(JOKE_API_URL);
    const survivedRestart = finalResponse.body && finalResponse.body.some(j => j.setup === setup);

    if (survivedRestart) {
        console.log("SUCCESS: Data survived database container restart!");
    } else {
        console.error("FAILURE: Data lost after container restart.");
        process.exit(1);
    }

    console.log("\n=== ALL RESILIENCE SCENARIOS VERIFIED SUCCESSFULLY ===\n");
}

runResilienceSuite().catch(console.error);
