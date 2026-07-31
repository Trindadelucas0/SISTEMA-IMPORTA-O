const Fornecedor = require('../models/Fornecedor');
const comparativoService = require('../services/comparativoService');

async function hub(req, res, next) {
  try {
    const { kpis, totalReferencias } = await comparativoService.resumoHub();
    res.render('analises/index', {
      title: 'Análises',
      kpis,
      totalReferencias,
    });
  } catch (err) {
    next(err);
  }
}

async function comparativo(req, res, next) {
  try {
    const filtros = {
      q: req.query.q || '',
      fornecedor_id: req.query.fornecedor_id || '',
      somenteVariacao: req.query.somenteVariacao === '1' ? '1' : '',
      somenteTroca: req.query.somenteTroca === '1' ? '1' : '',
    };

    const { itens, kpis } = await comparativoService.listarComparativo(filtros, {
      incluirCusto: false,
    });
    const fornecedores = await Fornecedor.listarAtivos();

    res.render('analises/comparativo', {
      title: 'Comparativo de última compra',
      itens,
      kpis,
      filtros,
      fornecedores,
    });
  } catch (err) {
    next(err);
  }
}

async function item(req, res, next) {
  try {
    const referencia = decodeURIComponent(req.params.referencia || '');
    const detalhe = await comparativoService.detalheReferencia(referencia, {
      incluirCusto: true,
    });

    if (!detalhe) {
      return res.status(404).render('errors/404', {
        title: 'Item não encontrado',
        message: 'Não há compras com essa referência.',
        pathTried: req.originalUrl,
      });
    }

    res.render('analises/item', {
      title: `Análise · ${detalhe.referencia}`,
      item: detalhe,
    });
  } catch (err) {
    next(err);
  }
}

async function custoLandado(req, res, next) {
  try {
    const filtros = {
      q: req.query.q || '',
      fornecedor_id: req.query.fornecedor_id || '',
      somenteCusto: req.query.somenteCusto === '1' ? '1' : '',
    };

    const { itens, kpis } = await comparativoService.listarComparativo(filtros, {
      incluirCusto: true,
    });
    const fornecedores = await Fornecedor.listarAtivos();

    res.render('analises/custo-landado', {
      title: 'Variação de custo landado',
      itens,
      kpis,
      filtros,
      fornecedores,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  hub,
  comparativo,
  item,
  custoLandado,
};
