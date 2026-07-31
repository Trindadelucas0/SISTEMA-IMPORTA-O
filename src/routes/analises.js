const express = require('express');
const analiseController = require('../controllers/analiseController');

const router = express.Router();

router.get('/', analiseController.hub);
router.get('/comparativo', analiseController.comparativo);
router.get('/comparativo/item/:referencia', analiseController.item);
router.get('/custo-landado', analiseController.custoLandado);

module.exports = router;
