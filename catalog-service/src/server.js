const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const productRoutes = require('./routes/productRoutes');
const productRepository = require('./repositories/productRepository');

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '50mb' }));

app.use('/api/v1/catalog', productRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'catalog-service' });
});

const PORT = process.env.PORT || 7006;

const server = app.listen(PORT, async () => {
    console.log(`Catalog Service running on port ${PORT}`);
    try {
        await productRepository.initDB();
        console.log('Database Initialization completed.');
    } catch (err) {
        console.error('Database Initialization failed:', err.message);
    }
});

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down Catalog Service gracefully...`);
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
