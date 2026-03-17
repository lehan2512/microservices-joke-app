/**
 * @file etl.js
 * @description Joke ETL (Extract, Transform, Load) service.
 * Consumes moderated jokes from RabbitMQ, transforms them, and persists them into the database.
 * Also broadcasts newly discovered joke types back to the system.
 */

require('dotenv').config();
const amqp = require('amqplib');
const db = require('./db');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://jokes_rabbitmq';
const MODERATED_QUEUE = 'moderated';
const TYPE_UPDATE_EXCHANGE = 'type_update_exchange';

/**
 * Normalizes a joke type string for consistent database storage.
 * @param {string} type - The raw joke type.
 * @returns {string} - The normalized joke type.
 */
function normalizeType(type) {
    if (type === null || type === undefined) return '';
    return String(type).normalize('NFC').toLowerCase().trim();
}

/**
 * Initializes the ETL process: connects to RabbitMQ and starts consuming moderated jokes.
 * Handles reconnection logic if RabbitMQ becomes unavailable.
 * @returns {Promise<void>}
 */
async function startETL() {
    let connection;
    try {
        console.log("Connecting to RabbitMQ...");
        connection = await amqp.connect(RABBITMQ_URL);
        
        // Handle connection closure
        connection.on('close', () => {
            console.log("RabbitMQ connection closed. Retrying in 5s...");
            setTimeout(startETL, 5000);
        });

        const channel = await connection.createChannel();

        await channel.assertQueue(MODERATED_QUEUE, { durable: true });
        await channel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });

        console.log(`ETL Service listening on "${MODERATED_QUEUE}"...`);

        // Strict QoS: Process only 1 message at a time to ensure persistence safety
        channel.prefetch(1);

        channel.consume(MODERATED_QUEUE, async (msg) => {
            if (msg !== null) {
                const payload = JSON.parse(msg.content.toString());
                try {
                    // 1. ATTEMPT PROCESSING
                    await processPayload(payload, { dbModule: db, channel });

                    // 2. POST-WRITE ACKNOWLEDGMENT
                    channel.ack(msg);
                    console.log("SUCCESS: Joke saved and acknowledged:", payload.setup);

                } catch (error) {
                    // 3. HANDLING FAILURE
                    console.error("DB Write Failed. Requeueing message:", error.message);
                    
                    try {
                        // Nack so it stays in queue
                        channel.nack(msg, false, true);
                    } catch (e) {
                        console.error("Error during failover cleanup:", e.message);
                    }
                }
            }
        }, { noAck: false });
    } catch (error) {
        console.error("ETL Startup Error. Retrying in 5s...", error.message);
        setTimeout(startETL, 5000);
    }
}

/**
 * Processes a single joke payload.
 * Saves the joke to the database and broadcasts a type update if the joke type is new.
 * @param {Object} payload - The joke payload containing setup, punchline, and type.
 * @param {Object} options - Processing dependencies.
 * @param {Object} [options.dbModule=db] - The database module to use.
 * @param {Object} [options.channel=null] - The RabbitMQ channel for broadcasting updates.
 * @returns {Promise<{isNewType: boolean, safeType: string}>} - The result of processing.
 */
async function processPayload(payload, { dbModule = db, channel = null } = {}) {
    const { setup, punchline, type } = payload || {};
    const safeType = normalizeType(type);

    const isNewType = await dbModule.insertJokeAndType(setup, punchline, safeType);

    // Broadcast type update to submit/moderate instances via ECST
    if (isNewType && channel) {
        console.log(`New type detected: ${safeType}. Broadcasting to exchange.`);
        const eventPayload = JSON.stringify({ type: safeType });
        channel.publish(TYPE_UPDATE_EXCHANGE, '', Buffer.from(eventPayload));
    }

    return { isNewType, safeType };
}

module.exports = { normalizeType, startETL, processPayload };

if (require.main === module) {
    startETL();
}
