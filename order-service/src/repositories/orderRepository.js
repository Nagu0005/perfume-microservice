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
                payment_method VARCHAR(50) DEFAULT 'Online Payment',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await db.query(createTableQuery);
        // Migration: Add payment_method column if it doesn't exist
        try {
            await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Online Payment'`);
        } catch (err) {
            console.log("Migration check order payment_method:", err.message);
        }
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
        const { checkout_id, user_id, order_total, shipping_address, payment_method } = orderData;
        const result = await db.query(
            `INSERT INTO orders (checkout_id, user_id, order_total, status, shipping_address, payment_method) 
             VALUES ($1, $2, $3, 'CREATED', $4, $5) RETURNING *`,
            [checkout_id, user_id, order_total, shipping_address || null, payment_method || 'Online Payment']
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
