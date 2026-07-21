const express = require('express');
const pedidoController = require('../controllers/pedidoController');

const router = express.Router();

router.get('/', pedidoController.listar);
router.get('/novo', pedidoController.formNovo);
router.post('/', pedidoController.criar);
router.get('/:id', pedidoController.detalhe);
router.get('/:id/editar', pedidoController.formEditar);
router.put('/:id', pedidoController.atualizar);
router.delete('/:id', pedidoController.remover);

router.post('/:id/itens', pedidoController.adicionarItem);
router.put('/:id/itens/:itemId', pedidoController.atualizarItem);
router.delete('/:id/itens/:itemId', pedidoController.removerItem);

module.exports = router;
