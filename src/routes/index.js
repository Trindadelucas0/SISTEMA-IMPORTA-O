const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { requirePermissao } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requirePermissao('dashboard'), dashboardController.dashboard);

module.exports = router;
