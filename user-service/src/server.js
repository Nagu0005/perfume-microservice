const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const userRepository = require('./repositories/userRepository');

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/users', userRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'user-service' });
});

const PORT = process.env.PORT || 7010;

const server = app.listen(PORT, async () => {
    console.log(`User Service running on port ${PORT}`);
    try {
        await userRepository.initDB();
        console.log('User Database Initialized.');
    } catch (err) {
        console.error('DB Init Error:', err.message);
    }
});

const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down User Service gracefully...`);
    server.close(async () => {
        try {
            const { pool } = require('./config/db');
            await pool.end();
            console.log('Database pool closed.');
        } catch (err) {
            console.error('Error closing DB pool:', err.message);
        }
        process.exit(0);
    });
    setTimeout(() => { process.exit(1); }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
