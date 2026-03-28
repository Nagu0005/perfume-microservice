const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const authMiddleware = require('./middleware/authMiddleware');

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Protect sensitive endpoints
app.use(authMiddleware);

// Define Microservices Registry
const services = {
    catalog: 'http://catalog-service:7006',
    cart: 'http://cart-service:7001',
    checkout: 'http://checkout-service:7004',
    order: 'http://order-service:5003',
    payment: 'http://payment-service:7003',
    shipping: 'http://shipping-service:7008',
    email: 'http://email-service:7005',
    recommendation: 'http://recommendation-service:7007',
    ad: 'http://ad-service:7002',
    currency: 'http://currency-service:7009',
    users: 'http://user-service:7010'
};

// Proxy options factory
const createProxyOptions = (name, target) => ({
    target,
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${target}${proxyReq.path}`);
        proxyReq.setHeader('X-Trace-Id', Date.now().toString());
        if (req.user) {
            proxyReq.setHeader('X-User-Id', req.user.id);
            proxyReq.setHeader('X-User-Email', req.user.email);
            proxyReq.setHeader('X-User-Role', req.user.is_admin ? 'admin' : 'user');
        }
    },
    onError: (err, req, res) => {
        console.error(`Error communicating with ${name} service:`, err.message);
        if (!res.headersSent) {
            res.status(502).json({ error: 'Bad Gateway', message: `${name} service is unavailable` });
        }
    }
});

// Route Setup - Generic /api/v1/<service> proxy
Object.entries(services).forEach(([name, target]) => {
    app.use(
        `/api/v1/${name}`,
        createProxyMiddleware({
            ...createProxyOptions(name, target),
            pathRewrite: (path, req) => req.originalUrl
        })
    );
});

// Explicit mappings for frontend API paths
app.use('/products', createProxyMiddleware({ ...createProxyOptions('catalog', services.catalog), pathRewrite: (path, req) => req.originalUrl.replace(/^\/products/, '/api/v1/products') }));
app.use('/cart', createProxyMiddleware({ ...createProxyOptions('cart', services.cart), pathRewrite: (path, req) => req.originalUrl.replace(/^\/cart/, '/api/v1/cart') }));
app.use('/checkout', createProxyMiddleware({ ...createProxyOptions('checkout', services.checkout), pathRewrite: (path, req) => req.originalUrl.replace(/^\/checkout/, '/api/v1/checkout') }));
app.use('/orders', createProxyMiddleware({ ...createProxyOptions('order', services.order), pathRewrite: (path, req) => req.originalUrl.replace(/^\/orders/, '/api/v1/orders') }));
app.use('/recommendations', createProxyMiddleware({ ...createProxyOptions('recommendation', services.recommendation), pathRewrite: (path, req) => req.originalUrl.replace(/^\/recommendations/, '/api/v1/recommendations') }));
app.use('/currency', createProxyMiddleware({ ...createProxyOptions('currency', services.currency), pathRewrite: (path, req) => req.originalUrl.replace(/^\/currency/, '/api/v1/currency') }));
app.use('/ads', createProxyMiddleware({ ...createProxyOptions('ad', services.ad), pathRewrite: (path, req) => req.originalUrl.replace(/^\/ads/, '/api/v1/ads') }));
app.use('/users', createProxyMiddleware({ ...createProxyOptions('users', services.users), pathRewrite: (path, req) => req.originalUrl.replace(/^\/users/, '/api/v1/users') }));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'API Gateway is functioning normally' });
});

const PORT = process.env.PORT || 8090;

const server = app.listen(PORT, () => {
    console.log(`API Gateway started successfully on port ${PORT}`);
    console.log('Routing traffic to Downstream Microservices...');
});

// Graceful shutdown
const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down API Gateway gracefully...`);
    server.close(() => {
        console.log('API Gateway closed.');
        process.exit(0);
    });
    setTimeout(() => { process.exit(1); }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
