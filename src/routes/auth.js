const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/login', authController.formLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

module.exports = router;
