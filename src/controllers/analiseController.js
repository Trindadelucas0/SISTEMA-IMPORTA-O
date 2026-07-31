const Fornecedor = require('../models/Fornecedor');
const Pedido = require('../models/Pedido');
const comparativoService = require('../services/comparativoService');

function tituloComparativo(modo, modoInfo) {
  if (modo === 'dois_pedidos' && modoInfo?.pedidoA && modoInfo?.pedidoB) {
    return `Comparativo · ${modoInfo.pedidoA.codigo} vs ${modoInfo.pedidoB.codigo}`;
  }
  if (modo === 'pedido_base' && modoInfo?.pedidoBase) {
    return `Comparativo · pedido ${modoInfo.pedidoBase.codigo}`;
  }
  if (modo === 'dois_pedidos') return 'Comparativo de pedidos';
  if (modo === 'pedido_base') return 'Comparativo por pedido base';
  return 'Comparativo de última compra';
}

function subtituloComparativo(modo) {
  if (modo === 'dois_pedidos') {
    return 'Itens em comum entre dois pedidos: preço, quantidade e fornecedor.';
  }
  if (modo === 'pedido_base') {
    return 'Itens do pedido escolhido vs compra anterior da mesma referência.';
  }
  return 'Última vs anterior por referência: preço, quantidade e fornecedor.';
}

function mensagemVazia(emptyReason) {
  const map = {
    selecione_dois_pedidos: 'Selecione dois pedidos para comparar.',
    pedidos_iguais: 'Escolha dois pedidos diferentes.',
    pedidos_invalidos: 'Pedidos não encontrados.',
    pedido_sem_itens: 'O pedido selecionado não tem itens com referência.',
    nenhum_item_comum: 'Nenhum item em comum entre os dois pedidos.',
    selecione_pedido_base: 'Selecione um pedido base para comparar.',
    nenhum_item_filtro: 'Nenhum item encontrado com esses filtros.',
  };
  return map[emptyReason] || 'Nenhum item encontrado com esses filtros.';
}

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
    const modo = comparativoService.normalizarModo(req.query.modo);
    const filtros = {
      modo,
      q: req.query.q || '',
      fornecedor_id: req.query.fornecedor_id || '',
      somenteVariacao: req.query.somenteVariacao === '1' ? '1' : '',
      somenteTroca: req.query.somenteTroca === '1' ? '1' : '',
      pedido_a: req.query.pedido_a || '',
      pedido_b: req.query.pedido_b || '',
      pedido_id: req.query.pedido_id || '',
    };

    const { itens, kpis, emptyReason, modoInfo, aviso } =
      await comparativoService.listarComparativo(filtros, {
        incluirCusto: false,
      });
    const [fornecedores, pedidos] = await Promise.all([
      Fornecedor.listarAtivos(),
      Pedido.listar(),
    ]);

    const title = tituloComparativo(modo, modoInfo);

    res.render('analises/comparativo', {
      title,
      pageTitle: title,
      pageSub: subtituloComparativo(modo),
      itens,
      kpis,
      filtros,
      fornecedores,
      pedidos,
      modo,
      modoInfo,
      emptyReason,
      emptyMessage: mensagemVazia(emptyReason),
      aviso,
    });
  } catch (err) {
    next(err);
  }
}

async function item(req, res, next) {
  try {
    const referencia = decodeURIComponent(req.params.referencia || '');
    const compraA = req.query.compra_a || '';
    const compraB = req.query.compra_b || '';

    const detalhe = await comparativoService.detalheReferencia(referencia, {
      incluirCusto: true,
      compraA,
      compraB,
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
      filtros: {
        compra_a: detalhe.parEscolhido ? String(detalhe.compraAId || '') : compraA,
        compra_b: detalhe.parEscolhido ? String(detalhe.compraBId || '') : compraB,
      },
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
      modo: 'automatico',
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
