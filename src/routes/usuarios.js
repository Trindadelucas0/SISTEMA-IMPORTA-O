const express = require('express');
const usuarioController = require('../controllers/usuarioController');
const { requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', usuarioController.listar);
router.get('/novo', usuarioController.formNovo);
router.post('/', usuarioController.criar);
router.get('/:id/editar', usuarioController.formEditar);
router.put('/:id', usuarioController.atualizar);
router.get('/:id/senha', usuarioController.formSenha);
router.post('/:id/senha', usuarioController.renovarSenha);

module.exports = router;
