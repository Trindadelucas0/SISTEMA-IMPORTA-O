const express = require('express');
const configuracoesController = require('../controllers/configuracoesController');
const { requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', configuracoesController.index);
router.get('/senha', configuracoesController.listarSenha);

module.exports = router;
