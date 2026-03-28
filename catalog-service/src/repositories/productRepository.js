const db = require('../config/db');

// Database Layer: Handles all direct database interactions
class ProductRepository {

    // Create the table on startup (for simplicity in this microservice demo)
    async initDB() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                brand VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                base_price NUMERIC(10, 2) NOT NULL,
                gst_percentage NUMERIC(5, 2) NOT NULL,
                image_url TEXT,
                description TEXT,
                seller_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await db.query(createTableQuery);
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
        const { name, brand, category, base_price, gst_percentage, image_url, description, seller_id } = product;
        const result = await db.query(
            `INSERT INTO products (name, brand, category, base_price, gst_percentage, image_url, description, seller_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, brand, category, base_price, gst_percentage, image_url, description, seller_id]
        );
        return result.rows[0];
    }

    async update(id, product) {
        const { name, brand, category, base_price, gst_percentage, image_url, description } = product;
        const result = await db.query(
            `UPDATE products 
             SET name = $1, brand = $2, category = $3, base_price = $4, gst_percentage = $5, image_url = $6, description = $7
             WHERE id = $8 RETURNING *`,
            [name, brand, category, base_price, gst_percentage, image_url, description, id]
        );
        return result.rows[0];
    }

    async delete(id) {
        const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}

module.exports = new ProductRepository();
