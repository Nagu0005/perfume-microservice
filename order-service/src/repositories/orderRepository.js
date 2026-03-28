const db = require('../config/db');

class OrderRepository {
    async initDB() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                checkout_id INT NOT NULL,
                user_id VARCHAR(100) NOT NULL,
                order_total NUMERIC(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'CREATED',
                tracking_number VARCHAR(100),
                shipping_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await db.query(createTableQuery);
    }

    async findAll() {
        const result = await db.query('SELECT * FROM orders ORDER BY id DESC');
        return result.rows;
    }

    async findById(id) {
        const result = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
        return result.rows[0];
    }

    async findByUserId(userId) {
        const result = await db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }

    async create(orderData) {
        const { checkout_id, user_id, order_total, shipping_address } = orderData;
        const result = await db.query(
            `INSERT INTO orders (checkout_id, user_id, order_total, status, shipping_address) 
             VALUES ($1, $2, $3, 'CREATED', $4) RETURNING *`,
            [checkout_id, user_id, order_total, shipping_address || null]
        );
        return result.rows[0];
    }

    async updateStatus(id, status, trackingNo = null) {
        let query = `UPDATE orders SET status = $1`;
        let params = [status];
        let paramCount = 2;

        if (trackingNo) {
            query += `, tracking_number = $${paramCount}`;
            params.push(trackingNo);
            paramCount++;
        }

        query += ` WHERE id = $${paramCount} RETURNING *`;
        params.push(id);

        const result = await db.query(query, params);
        return result.rows[0];
    }
}

module.exports = new OrderRepository();
