require('dotenv').config();
let amqp;
try {
    amqp = require('amqplib');
} catch (e) {
    amqp = null;
}
const db = require('./db');

function normalizeType(type) {
    if (type === null || type === undefined) return '';
    return String(type).normalize('NFC').toLowerCase().trim();
}

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://jokes_rabbitmq';
const MODERATED_QUEUE = 'moderated';
const TYPE_UPDATE_EXCHANGE = 'type_update_exchange';

async function startETL() {
    try {
        if (!amqp) return;
        console.log("Connecting to RabbitMQ...");
        const connection = await amqp.connect(RABBITMQ_URL);
        
        connection.on('error', (err) => {
            console.error("RabbitMQ Connection Error:", err.message);
            setTimeout(startETL, 5000);
        });

        const channel = await connection.createChannel();

        await channel.assertQueue(MODERATED_QUEUE, { durable: true });
        await channel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });

        console.log(`ETL Service listening on "${MODERATED_QUEUE}"...`);

        channel.consume(MODERATED_QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const payload = JSON.parse(msg.content.toString());
                    
                    // RESILIENCE PATTERN:
                    // 1. Attempt database write
                    await processPayload(payload, { dbModule: db, channel });
                    
                    // 2. POST-WRITE ACKNOWLEDGMENT:
                    // Only acknowledge if DB write succeeded.
                    channel.ack(msg);
                    console.log("Successfully processed and acknowledged message.");
                } catch (error) {
                    // 3. HANDLING FAILURE:
                    // If DB is down, nack with requeue:true.
                    // The robust connection pool in db.js will re-resolve DNS on retry.
                    console.error("DB Write Failed. Requeueing for retry...", error.message);
                    
                    try {
                        channel.nack(msg, false, true);
                    } catch (e) {
                        console.error("Failed to nack message:", e.message);
                    }
                    
                    // Backoff delay before next attempt
                    await new Promise(r => setTimeout(r, 5000));
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
