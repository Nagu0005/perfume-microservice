const userService = require('../services/userService');

class UserController {
    async register(req, res) {
        try {
            const { name, email, password } = req.body;
            if (!name || !email || !password) {
                return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
            }

            const result = await userService.registerUser({ name, email, password });
            res.status(201).json({ success: true, data: result.user, token: result.token });
        } catch (error) {
            if (error.message === 'Email already in use') {
                return res.status(409).json({ success: false, error: error.message });
            }
            res.status(500).json({ success: false, error: 'Registration failed', details: error.message });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ success: false, error: 'Email and password are required' });
            }

            const result = await userService.loginUser(email, password);
            res.status(200).json({ success: true, data: result.user, token: result.token });
        } catch (error) {
            res.status(401).json({ success: false, error: error.message });
        }
    }

    async getProfile(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
            }

            const token = authHeader.split(' ')[1];
            const user = await userService.verifyAndGetUser(token);

            res.status(200).json({ success: true, data: user });
        } catch (error) {
            res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
        }
    }

    async adminGoogleLogin(req, res) {
        try {
            const { credential } = req.body;
            if (!credential) {
                return res.status(400).json({ success: false, error: 'Missing Google credential' });
            }

            const result = await userService.loginWithGoogle(credential);
            res.status(200).json({ success: true, data: result.user, token: result.token });
        } catch (error) {
            res.status(403).json({ success: false, error: error.message });
        }
    }

    async getProfile(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            const token = authHeader.split(' ')[1];
            const user = await userService.verifyAndGetUser(token);
            res.status(200).json({ success: true, data: user });
        } catch (error) {
            res.status(403).json({ success: false, error: error.message });
        }
    }

    async updateProfile(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
            }
            const token = authHeader.split(' ')[1];
            const user = await userService.verifyAndGetUser(token);

            const profileData = req.body;
            const updatedUser = await userService.updateUserProfile(user.id, profileData);
            res.status(200).json({ success: true, data: updatedUser });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async getPublicProfile(req, res) {
        try {
            const { id } = req.params;
            const profile = await userService.getPublicProfile(id);
            res.status(200).json({ success: true, data: profile });
        } catch (error) {
            res.status(404).json({ success: false, error: error.message });
        }
    }

    async promoteUser(req, res) {
        try {
            // Note: gateway normally protects this if we put it behind the right URL, but we will ensure it exists.
            const { id } = req.params;
            const updatedUser = await userService.promoteUser(id);
            res.status(200).json({ success: true, data: updatedUser });
        } catch (error) {
            res.status(404).json({ success: false, error: error.message });
        }
    }

    async getAllUsers(req, res) {
        try {
            const users = await userService.getAllUsers();
            res.status(200).json({ success: true, data: users });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new UserController();
