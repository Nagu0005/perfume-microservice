const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-aurora';

const authMiddleware = (req, res, next) => {
    // Check if the route is one of the secure routes
    const isSecureRoute = 
        (req.method === 'POST' && req.originalUrl.startsWith('/api/v1/catalog')) ||
        (req.method === 'PUT' && req.originalUrl.startsWith('/api/v1/catalog')) ||
        (req.method === 'DELETE' && req.originalUrl.startsWith('/api/v1/catalog')) ||
        (req.method === 'GET' && req.originalUrl.startsWith('/api/v1/orders')) ||
        (req.method === 'GET' && req.originalUrl.startsWith('/api/v1/users/admin/users')) ||
        (req.method === 'PUT' && req.originalUrl.startsWith('/api/v1/users/admin/users')); 

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (!isSecureRoute) return next();
        return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authentication token.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Ensure only Admins can hit these sensitive routes
        if (isSecureRoute && !decoded.is_admin) {
            return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required for this action.' });
        }

        // Attach decoded user info to request
        req.user = decoded;
        next();
    } catch (err) {
        if (!isSecureRoute) return next();
        return res.status(401).json({ error: 'Unauthorized', message: 'Expired or invalid token.' });
    }
};

module.exports = authMiddleware;
