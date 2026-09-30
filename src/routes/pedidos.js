const express = require('express');
const pedidoController = require('../controllers/pedidoController');
const { requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.get('/', pedidoController.listar);
router.get('/novo', pedidoController.formNovo);
router.post('/', pedidoController.criar);
router.get('/:id', pedidoController.detalhe);
router.get('/:id/editar', pedidoController.formEditar);
router.get('/:id/lista-fornecedor', pedidoController.listaFornecedor);
router.put('/:id/status', requireAdmin, pedidoController.atualizarStatus);
router.put('/:id', pedidoController.atualizar);
router.delete('/:id', pedidoController.remover);

router.post('/:id/itens', pedidoController.adicionarItem);
router.put('/:id/itens/:itemId', pedidoController.atualizarItem);
router.delete('/:id/itens/:itemId', pedidoController.removerItem);

module.exports = router;
