const express = require('express');
const produtoController = require('../controllers/produtoController');

const router = express.Router();

router.get('/', produtoController.listar);
router.get('/novo', produtoController.formNovo);
router.post('/', produtoController.criar);
router.get('/:id/editar', produtoController.formEditar);
router.put('/:id', produtoController.atualizar);
router.delete('/:id', produtoController.remover);

module.exports = router;
