const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Routes xác thực
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/current-user', authController.getCurrentUser);
router.get('/all-users', authController.getAllUsers);

module.exports = router;