const db = require('../config/db');

class UserRepository {
    async initDB() {
        // Table creation
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                is_admin BOOLEAN DEFAULT FALSE,
                business_name VARCHAR(255),
                business_address TEXT,
                pincode VARCHAR(20),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await db.query(createTableQuery);

        // Ensure missing columns are added if the table already existed
        const checkColumns = [
            { name: 'is_admin', type: 'BOOLEAN DEFAULT FALSE' },
            { name: 'business_name', type: 'VARCHAR(100)' },
            { name: 'business_address', type: 'TEXT' },
            { name: 'pincode', type: 'VARCHAR(20)' }
        ];

        for (const col of checkColumns) {
            try {
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            } catch (err) {
                // Ignore errors if columns already exist or other safe-to-ignore schema issues
                console.log(`Column ${col.name} check: ${err.message}`);
            }
        }

        // Drop NOT NULL constraint on password_hash to support Google Login users
        try {
            await db.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
        } catch (err) {
            console.log(`Drop NOT NULL check: ${err.message}`);
        }
    }

    async findByEmail(email) {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    }

    async findById(id) {
        const result = await db.query('SELECT id, name, email, is_admin, business_name, business_address, pincode, created_at FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }

    async findPublicById(id) {
        const result = await db.query('SELECT id, business_name, pincode, created_at FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }

    async create(userData) {
        const { name, email, password_hash, is_admin = false } = userData;
        const result = await db.query(
            'INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, name, email, is_admin, created_at',
            [name, email, password_hash, is_admin]
        );
        return result.rows[0];
    }
    async promote(id) {
        const result = await db.query('UPDATE users SET is_admin = true WHERE id = $1 RETURNING id, name, email, is_admin', [id]);
        return result.rows[0];
    }
    async findAll() {
        const result = await db.query('SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC');
        return result.rows;
    }

    async updateProfile(id, profileData) {
        const { business_name, business_address, pincode } = profileData;
        const result = await db.query(
            'UPDATE users SET business_name = $1, business_address = $2, pincode = $3 WHERE id = $4 RETURNING id, name, email, is_admin, business_name, business_address, pincode',
            [business_name, business_address, pincode, id]
        );
        return result.rows[0];
    }
}

module.exports = new UserRepository();
