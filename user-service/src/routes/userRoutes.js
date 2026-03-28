const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/register', userController.register);
router.post('/login', userController.login);

// Helper route to fetch user profile via JWT (optional, but good for robust frontend)
router.get('/profile', userController.getProfile);

// Profile Routes
router.put('/profile', userController.updateProfile);
router.get('/public/:id', userController.getPublicProfile);

// Admin Routes (These should ideally be protected by the Gateway)
router.post('/admin/google', userController.adminGoogleLogin);
router.get('/admin/users', userController.getAllUsers);
router.put('/admin/users/:id/promote', userController.promoteUser);

module.exports = router;
