const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const userRepository = require('../repositories/userRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-aurora';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);


class UserService {
    async registerUser(userData) {
        const existingUser = await userRepository.findByEmail(userData.email);
        if (existingUser) {
            throw new Error('Email already in use');
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(userData.password, salt);

        const newUser = await userRepository.create({
            name: userData.name,
            email: userData.email,
            password_hash
        });

        // Trigger Welcome Email asynchronously (fire-and-forget)
        this.triggerWelcomeEmail(newUser.email, newUser.name);

        const token = this.generateToken(newUser.id, newUser.email);
        return { user: { id: newUser.id, name: newUser.name, email: newUser.email }, token };
    }

    async loginUser(email, password) {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Invalid email or password'); // We should ideally use bcrypt timing safe checks, but this is fine for now
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            throw new Error('Invalid email or password');
        }

        const token = this.generateToken(user.id, user.email, user.is_admin);
        return { user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin }, token };
    }

    async loginWithGoogle(credential) {
        if (!GOOGLE_CLIENT_ID) throw new Error("Server not configured for Google Auth");

        // Verify the token cryptographically with Google
        const ticket = await oauthClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const { email, name } = payload;

        // Check if user exists in DB
        let user = await userRepository.findByEmail(email);

        // Check Root .env whitelist
        const rootAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
        const isRootAdmin = rootAdmins.includes(email.toLowerCase());

        if (!user) {
            // Register them automatically
            user = await userRepository.create({
                name: name,
                email: email,
                password_hash: null, // No password for Google users
                is_admin: isRootAdmin
            });
            this.triggerWelcomeEmail(user.email, user.name);
        } else if (isRootAdmin && !user.is_admin) {
            // Need to promote existing user to admin if in whitelist
             // We don't have a direct save in the repo right now, so we just trust the root list for the token
             user.is_admin = true;
        }

        if (!user.is_admin && !isRootAdmin) {
            throw new Error("You are not an authorized seller/admin.");
        }

        const token = this.generateToken(user.id, user.email, true);
        return { user: { id: user.id, name: user.name, email: user.email, is_admin: true }, token };
    }

    async verifyAndGetUser(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await userRepository.findById(decoded.id);
            if (!user) throw new Error('User not found');
            return user;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async promoteUser(id) {
        const user = await userRepository.promote(id);
        if (!user) throw new Error("User not found");
        return user;
    }

    async getAllUsers() {
        return await userRepository.findAll();
    }
    
    generateToken(id, email, is_admin = false) {
        return jwt.sign({ id, email, is_admin }, JWT_SECRET, { expiresIn: '7d' });
    }

    async updateUserProfile(userId, profileData) {
        if (!profileData.business_name || !profileData.pincode) {
            throw new Error('Business Name and Pincode are mandatory for Store Profile.');
        }
        
        const updatedUser = await userRepository.updateProfile(userId, profileData);
        if (!updatedUser) throw new Error('User not found');
        return updatedUser;
    }

    async getPublicProfile(userId) {
        const profile = await userRepository.findPublicById(userId);
        if (!profile) throw new Error('Seller profile not found');
        return profile;
    }

    // Trigger HTTP Request to Email Service directly
    async triggerWelcomeEmail(email, name) {
        try {
            const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://email-service:7005/api/v1/emails';

            const payload = {
                recipient: email,
                subject: 'Welcome to Aurora Perfumes',
                body: `Hello ${name},\n\nWelcome to Aurora Perfumes! We are thrilled to have you join our exclusive club.\n\nDiscover the essence of elegance today.\n\nBest Regards,\nThe Aurora Team`,
                type: 'WELCOME'
            };

            // Using global fetch (available in Node 18+)
            fetch(EMAIL_SERVICE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(err => console.error('Failed to notify EmailService asynchronously:', err.message));

        } catch (error) {
            console.error('Failed to setup Welcome email trigger:', error.message);
        }
    }
}

module.exports = new UserService();
