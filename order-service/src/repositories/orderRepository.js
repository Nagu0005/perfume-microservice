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

            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INT REFERENCES orders(id) ON DELETE CASCADE,
                product_id INT NOT NULL,
                product_name VARCHAR(255),
                price_at_time NUMERIC(10, 2) NOT NULL,
                quantity INT NOT NULL
            );
        `;
        await db.query(createTableQuery);
        // Migration: Add payment_method column if it doesn't exist
        try {
            await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Online Payment'`);
            await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT`);
        } catch (err) {
            console.log("Migration check order columns:", err.message);
        }
    }

    async findAll() {
        const ordersRes = await db.query('SELECT * FROM orders ORDER BY id DESC');
        const orders = ordersRes.rows;
        
        for (let order of orders) {
            const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            order.items = itemsRes.rows;
        }
        return orders;
    }

    async findById(id) {
        const result = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
        const order = result.rows[0];
        if (order) {
            const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            order.items = itemsRes.rows;
        }
        return order;
    }

    async findByUserId(userId) {
        const result = await db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        const orders = result.rows;
        
        for (let order of orders) {
            try {
                const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
                order.items = itemsRes.rows || [];
            } catch (itemErr) {
                console.error(`Error fetching items for order ${order.id}:`, itemErr.messsage);
                order.items = [];
            }
        }
        return orders;
    }

    async create(orderData) {
        const { checkout_id, user_id, order_total, shipping_address, payment_method, items } = orderData;
        
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            const orderResult = await client.query(
                `INSERT INTO orders (checkout_id, user_id, order_total, status, shipping_address, payment_method) 
                 VALUES ($1, $2, $3, 'CREATED', $4, $5) RETURNING *`,
                [checkout_id, user_id, order_total, shipping_address || null, payment_method || 'Online Payment']
            );
            
            const newOrder = orderResult.rows[0];
            
            if (items && Array.isArray(items)) {
                for (const item of items) {
                    await client.query(
                        `INSERT INTO order_items (order_id, product_id, product_name, price_at_time, quantity) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [newOrder.id, item.product_id, item.name, item.price, item.quantity]
                    );
                }
            }
            
            await client.query('COMMIT');
            
            // Re-fetch to get items included
            return await this.findById(newOrder.id);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
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
