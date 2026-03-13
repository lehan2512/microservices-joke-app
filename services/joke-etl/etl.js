require('dotenv').config();
const amqp = require('amqplib');
const db = require('./db');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://jokes_rabbitmq';
const MODERATED_QUEUE = 'moderated';
const TYPE_UPDATE_EXCHANGE = 'type_update_exchange';

function normalizeType(type) {
    if (type === null || type === undefined) return '';
    return String(type).normalize('NFC').toLowerCase().trim();
}

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

        // Only take 1 message at a time
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
                    console.error("DB Write Failed. Requeueing message and resetting connection:", error.message);
                    
                    try {
                        // Nack so it stays in queue
                        channel.nack(msg, false, true);
                        // Close connection to purge stale state/pools
                        await connection.close();
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

async function processPayload(payload, { dbModule = db, channel = null } = {}) {
    const { setup, punchline, type } = payload || {};
    const safeType = normalizeType(type);

    const isNewType = await dbModule.insertJokeAndType(setup, punchline, safeType);

    if (isNewType && channel) {
        const eventPayload = JSON.stringify({ type: safeType });
        channel.publish(TYPE_UPDATE_EXCHANGE, '', Buffer.from(eventPayload));
    }

    return { isNewType, safeType };
}

module.exports = { normalizeType, startETL, processPayload };

if (require.main === module) {
    startETL();
}
