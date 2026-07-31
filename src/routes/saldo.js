const express = require('express');
const saldoController = require('../controllers/saldoController');

const router = express.Router();

router.get('/', saldoController.index);
router.post('/alocar', saldoController.alocar);
router.delete('/alocacoes/:id', saldoController.removerAlocacao);

module.exports = router;
