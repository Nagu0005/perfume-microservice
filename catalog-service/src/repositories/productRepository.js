const db = require('../config/db');

// Database Layer: Handles all direct database interactions
class ProductRepository {

    // Create the table on startup (for simplicity in this microservice demo)
    async initDB() {
        console.log('ProductRepository: Starting Database Initialization...');
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                brand VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                base_price NUMERIC(10, 2) NOT NULL,
                gst_percentage NUMERIC(5, 2) NOT NULL,
                image_url TEXT,
                images TEXT[] DEFAULT '{}',
                description TEXT,
                stock_quantity INTEGER DEFAULT 0,
                seller_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        try {
            await db.query(createTableQuery);
            console.log('ProductRepository: Table "products" check/create completed.');

            // Migration: Add images column if it doesn't exist
            console.log('ProductRepository: Verifying schema migrations (images column)...');
            await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'`);
            await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0`);
            await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100)`);
            console.log('ProductRepository: Schema migrations completed successfully.');
        } catch (err) {
            console.error('ProductRepository: Error during database initialization:', err.message);
            throw err; // Re-throw to be caught by the server start logic
        }
    }

    async findAll() {
        const result = await db.query('SELECT * FROM products ORDER BY id ASC');
        return result.rows;
    }

    async findById(id) {
        const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
        return result.rows[0];
    }

    async findByCategory(category) {
        const result = await db.query('SELECT * FROM products WHERE category = $1', [category]);
        return result.rows;
    }

    async create(product) {
        const { name, brand, category, sub_category, base_price, gst_percentage, image_url, images, description, seller_id } = product;
        const result = await db.query(
            `INSERT INTO products (name, brand, category, sub_category, base_price, gst_percentage, image_url, images, description, stock_quantity, seller_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [name, brand, category, sub_category || 'Men', base_price, gst_percentage, image_url, images || [], description, product.stock_quantity || 0, seller_id]
        );
        return result.rows[0];
    }

    async update(id, product) {
        const { name, brand, category, sub_category, base_price, gst_percentage, image_url, images, description, stock_quantity } = product;
        const result = await db.query(
            `UPDATE products 
             SET name = $1, brand = $2, category = $3, sub_category = $4, base_price = $5, gst_percentage = $6, image_url = $7, images = $8, description = $9, stock_quantity = $10
             WHERE id = $11 RETURNING *`,
            [name, brand, category, sub_category || 'Men', base_price, gst_percentage, image_url, images || [], description, stock_quantity || 0, id]
        );
        return result.rows[0];
    }

    async delete(id) {
        const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }

    async decrementStock(id, quantity) {
        const result = await db.query(
            `UPDATE products 
             SET stock_quantity = stock_quantity - $1 
             WHERE id = $2 AND stock_quantity >= $1 
             RETURNING *`,
            [quantity, id]
        );
        return result.rows[0];
    }
}

module.exports = new ProductRepository();
