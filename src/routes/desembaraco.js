const express = require('express');
const desembaracoController = require('../controllers/desembaracoController');

const router = express.Router();

router.get('/', desembaracoController.listarPedidos);
router.get('/:pedidoId', desembaracoController.show);
router.post('/:pedidoId', desembaracoController.salvar);

module.exports = router;
