const express = require('express');
const pagamentoController = require('../controllers/pagamentoController');

const router = express.Router();

router.get('/', pagamentoController.listar);
router.get('/novo', pagamentoController.formNovo);
router.post('/', pagamentoController.criar);
router.get('/:id/editar', pagamentoController.formEditar);
router.put('/:id', pagamentoController.atualizar);
router.delete('/:id', pagamentoController.remover);

module.exports = router;
