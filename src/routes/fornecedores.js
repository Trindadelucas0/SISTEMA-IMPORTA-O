const express = require('express');
const fornecedorController = require('../controllers/fornecedorController');

const router = express.Router();

router.get('/', fornecedorController.listar);
router.get('/novo', fornecedorController.formNovo);
router.get('/api/cnpj/:cnpj', fornecedorController.apiCnpj);
router.post('/', fornecedorController.criar);
router.get('/:id/editar', fornecedorController.formEditar);
router.put('/:id', fornecedorController.atualizar);
router.delete('/:id', fornecedorController.remover);

module.exports = router;
