require('dotenv').config();
let amqp;
try {
    amqp = require('amqplib');
} catch (e) {
    // amqplib optional for unit tests; ETL startup will be skipped when absent
    amqp = null;
}
const db = require('./db');

// normalizeType(type)
// Inline helper: canonicalize a type string for ETL processing.
// Steps: handle null/undefined, Unicode-normalize, lowercase, then trim.
function normalizeType(type) {
    if (type === null || type === undefined) return '';
    // NFC is a sensible default normalization form for most use-cases
    return String(type).normalize('NFC').toLowerCase().trim();
}

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://jokes_rabbitmq';
const MODERATED_QUEUE = 'moderated';
const TYPE_UPDATE_EXCHANGE = 'type_update_exchange';

async function startETL() {
    try {
        if (!amqp) {
            console.warn('amqplib not installed; startETL will be skipped during tests');
            return;
        }
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        // Ensure the queue exists before trying to consume from it
        await channel.assertQueue(MODERATED_QUEUE, { durable: true });

        // Ensure the fanout exchange exists for publishing ECST events
        await channel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });

        console.log(`ETL Service listening for messages on "${MODERATED_QUEUE}"...`);

        // Register the callback to consume messages
        channel.consume(MODERATED_QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const payload = JSON.parse(msg.content.toString());
                    console.log("ETL Received payload:", payload);

                    // Use the shared processing function so tests can call it directly
                    await processPayload(payload, { dbModule: db, channel });

                    // Acknowledge receipt so broker deletes the message
                    channel.ack(msg);
                    console.log("Message successfully processed and acknowledged.");
                } catch (error) {
                    console.error("Error processing message:", error);
                    // In a production app, you might route this to a Dead Letter Queue here
                }
            }
        });
    } catch (error) {
        console.error("RabbitMQ Connection Error. Retrying in 5s...", error.message);
        setTimeout(startETL, 5000); // Basic reconnection logic
    }
}

// processPayload(payload, { dbModule, channel })
// - payload: { setup, punchline, type }
// - dbModule (optional): override for the DB module (used in tests)
// - channel (optional): if provided, will be used to publish type update events
async function processPayload(payload, { dbModule = db, channel = null } = {}) {
    const { setup, punchline, type } = payload || {};
    const safeType = normalizeType(type);

    // Transform and Load into Database
    const isNewType = await dbModule.insertJokeAndType(setup, punchline, safeType);

    // If a new type was written, publish an event to the fanout exchange (if channel available)
    if (isNewType && channel && typeof channel.publish === 'function') {
        const eventPayload = JSON.stringify({ type: safeType });
        channel.publish(TYPE_UPDATE_EXCHANGE, '', Buffer.from(eventPayload));
        console.log(`Published event for new type: ${safeType}`);
    }

    return { isNewType, safeType };
}

// Export the helper for unit tests and the starter for direct execution
// Export the helper for unit tests and the starter for direct execution
module.exports = { normalizeType, startETL, processPayload };

// Only auto-start when run directly (require-safe for tests)
if (require.main === module) {
    startETL();
}