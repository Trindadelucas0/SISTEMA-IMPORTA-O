/**
 * Adicionar/remover itens do pedido sem reload (fetch + atualização do DOM).
 */
(function () {
  var form = document.getElementById('form-adicionar-item');
  var painel = document.getElementById('painel-itens');
  if (!form || !painel) return;

  var pedidoId = painel.getAttribute('data-pedido-id');
  var tbody = document.getElementById('itens-tbody');
  var emptyEl = document.getElementById('itens-empty');
  var tableWrap = document.getElementById('itens-table-wrap');
  var badge = document.getElementById('itens-badge');
  var btnAdd = document.getElementById('btn-adicionar-item');
  var statusEl = document.getElementById('form-item-status');
  var submitting = false;

  function moneyUsd(value) {
    var n = Number(value) || 0;
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  function moneyBrl(value) {
    var n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function numberBr(value, digits) {
    var n = Number(value) || 0;
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  var TITULO_TRAVA = 'Pedido quitado: quantidade e preço travados';

  /** Mesma regra de casasDecimais em show.ejs: não arredondar o valor gravado no input. */
  function casasDecimais(value, minimo) {
    var n = Number(value) || 0;
    for (var d = minimo; d < 4; d++) {
      var f = Math.pow(10, d);
      if (Math.abs(Math.round(n * f) / f - n) < 1e-9) return d;
    }
    return 4;
  }

  function inputBr(value, minimo) {
    return numberBr(value, casasDecimais(value, minimo));
  }

  function aplicarTrava(coberto) {
    painel.setAttribute('data-coberto', coberto ? '1' : '0');
    var campos = painel.querySelectorAll('input[name="quantidade"], input[name="preco_usd"]');
    campos.forEach(function (el) {
      el.readOnly = coberto;
      if (coberto) el.title = TITULO_TRAVA;
      else el.removeAttribute('title');
    });
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    if (!msg) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.className = 'alert';
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.className = 'alert ' + (isError ? 'alert-error' : 'alert-success');
    statusEl.setAttribute('role', isError ? 'alert' : 'status');
  }

  function coberturaPct(saldo) {
    var invoice = Number(saldo.invoice_usd) || 0;
    var alocado = Number(saldo.alocado_usd) || 0;
    if (invoice > 0) return Math.min(100, Math.round((alocado / invoice) * 1000) / 10);
    return saldo.coberto ? 100 : 0;
  }

  function atualizarSaldo(saldo) {
    if (!saldo) return;
    var invoice = Number(saldo.invoice_usd) || 0;
    var alocado = Number(saldo.alocado_usd) || 0;
    var falta = Number(saldo.falta_usd) || 0;
    var pct = coberturaPct(saldo);

    var kpiInvoice = document.getElementById('kpi-invoice');
    var kpiAlocado = document.getElementById('kpi-alocado');
    var kpiAlocadoBrl = document.getElementById('kpi-alocado-brl');
    var kpiFalta = document.getElementById('kpi-falta');
    var coberturaPctEl = document.getElementById('cobertura-pct');
    var coberturaMeta = document.getElementById('cobertura-meta');
    var coberturaBar = document.getElementById('cobertura-bar');
    var coberturaProgress = document.getElementById('cobertura-progress');
    var badgeStatus = document.getElementById('badge-cobertura-status');
    var alertaSaldo = document.getElementById('alerta-saldo');

    if (kpiInvoice) kpiInvoice.textContent = moneyUsd(invoice);
    if (kpiAlocado) kpiAlocado.textContent = moneyUsd(alocado);
    if (kpiAlocadoBrl) kpiAlocadoBrl.textContent = moneyBrl(saldo.alocado_brl);
    if (kpiFalta) {
      kpiFalta.textContent = moneyUsd(falta);
      kpiFalta.classList.toggle('text-bad', falta > 0);
      kpiFalta.classList.toggle('text-ok', falta <= 0);
    }
    if (coberturaPctEl) coberturaPctEl.textContent = pct + '%';
    if (coberturaMeta) {
      coberturaMeta.textContent =
        'Alocado ' + moneyUsd(alocado) + ' · Falta ' + moneyUsd(falta) + ' · Invoice ' + moneyUsd(invoice);
    }
    if (coberturaBar) coberturaBar.style.width = pct + '%';
    if (coberturaProgress) {
      coberturaProgress.classList.remove('progress-ok', 'progress-warn');
      if (saldo.coberto) coberturaProgress.classList.add('progress-ok');
      else if (pct > 0) coberturaProgress.classList.add('progress-warn');
    }
    if (badgeStatus) {
      badgeStatus.textContent = saldo.coberto ? 'Quitado fornecedor' : 'Aguardando saldo';
      badgeStatus.classList.remove('badge-ok', 'badge-warn', 'badge-danger');
      badgeStatus.classList.add(
        saldo.coberto ? 'badge-ok' : alocado > 0 ? 'badge-warn' : 'badge-danger'
      );
    }
    if (alertaSaldo) alertaSaldo.hidden = Boolean(saldo.coberto);
    aplicarTrava(Boolean(saldo.coberto));
  }

  function atualizarBadge(qtd) {
    if (badge) badge.textContent = qtd + ' item(ns)';
    var hasItens = qtd > 0;
    if (emptyEl) emptyEl.hidden = hasItens;
    if (tableWrap) tableWrap.hidden = !hasItens;
  }

  function limparFormProduto() {
    var ids = ['referencia', 'descricao', 'ncm'];
    ids.forEach(function (id) {
      var el = form.querySelector('#' + id);
      if (el) el.value = '';
    });
    var qtd = form.querySelector('#quantidade');
    var preco = form.querySelector('#preco_usd');
    if (qtd) qtd.value = '0';
    if (preco) preco.value = '0,00';

    var comboInput = form.querySelector('.produto-combobox-input');
    var comboClear = form.querySelector('.produto-combobox-clear');
    if (comboInput) comboInput.value = '';
    if (comboClear) comboClear.hidden = true;
  }

  function focarProximo() {
    var comboInput = form.querySelector('.produto-combobox-input');
    var ref = form.querySelector('#referencia');
    if (comboInput) comboInput.focus();
    else if (ref) ref.focus();
  }

  function campoLinha(opts) {
    var input = document.createElement('input');
    input.className = opts.className;
    input.name = opts.name;
    input.setAttribute('form', opts.formId);
    input.setAttribute('aria-label', opts.label);
    input.setAttribute('value', opts.value);
    if (opts.inputmode) input.setAttribute('inputmode', opts.inputmode);
    if (opts.required) input.required = true;
    input.hidden = true;
    return input;
  }

  function textoValor(valor) {
    return valor === '' || valor == null ? '—' : String(valor);
  }

  function valorLinha(opts) {
    var span = document.createElement('span');
    span.className = 'item-valor' + (opts.mono ? ' mono' : '');
    span.setAttribute('data-campo', opts.name);
    span.textContent = textoValor(opts.value);
    return span;
  }

  function celula(className, child) {
    var td = document.createElement('td');
    if (className) td.className = className;
    if (child) td.appendChild(child);
    return td;
  }

  function celulaCampo(className, opts) {
    var td = celula(className);
    td.appendChild(valorLinha(opts));
    td.appendChild(campoLinha(opts));
    return td;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function iconeLapis() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z'].forEach(function (d) {
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    });
    return svg;
  }

  function linkComparativo(referencia) {
    return '/analises/comparativo/item/' + encodeURIComponent(referencia);
  }

  function montarLinha(item) {
    var formId = 'form-item-' + item.id;
    var tr = document.createElement('tr');
    tr.className = 'item-edit';
    tr.setAttribute('data-item-id', String(item.id));

    var tdAmount = celula('num font-semibold');
    tdAmount.setAttribute('data-amount', '');
    tdAmount.textContent = moneyUsd(item.amount_usd);

    var btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn-editar-item';
    btnEditar.setAttribute('aria-label', 'Editar item');
    btnEditar.title = 'Editar item';
    btnEditar.appendChild(iconeLapis());

    var formEditar = document.createElement('form');
    formEditar.id = formId;
    formEditar.className = 'form-editar-item';
    formEditar.method = 'POST';
    formEditar.action = '/pedidos/' + pedidoId + '/itens/' + item.id + '?_method=PUT';
    formEditar.hidden = true;
    var btnSalvar = document.createElement('button');
    btnSalvar.type = 'submit';
    btnSalvar.className = 'btn btn-primary btn-sm';
    btnSalvar.textContent = 'Salvar';
    var btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn btn-ghost btn-sm btn-cancelar-item';
    btnCancelar.textContent = 'Cancelar';
    formEditar.appendChild(btnSalvar);
    formEditar.appendChild(btnCancelar);

    var aCmp = document.createElement('a');
    aCmp.className = 'link-action';
    aCmp.href = linkComparativo(item.referencia);
    aCmp.title = 'Ver análise vs última compra';
    aCmp.textContent = 'vs última';

    var formRemover = document.createElement('form');
    formRemover.className = 'form-remover-item';
    formRemover.method = 'POST';
    formRemover.action = '/pedidos/' + pedidoId + '/itens/' + item.id + '?_method=DELETE';
    var btnRemover = document.createElement('button');
    btnRemover.type = 'submit';
    btnRemover.className = 'link-danger';
    btnRemover.textContent = 'Remover';
    formRemover.appendChild(btnRemover);

    var acoes = document.createElement('div');
    acoes.className = 'item-acoes';
    acoes.appendChild(btnEditar);
    acoes.appendChild(formEditar);
    acoes.appendChild(aCmp);
    acoes.appendChild(formRemover);

    tr.appendChild(celulaCampo('', {
      className: 'field mono item-campo', name: 'referencia', formId: formId,
      label: 'REF', value: item.referencia || '', required: true, mono: true,
    }));
    tr.appendChild(celulaCampo('col-hide-sm', {
      className: 'field field-desc item-campo', name: 'descricao', formId: formId,
      label: 'Descrição', value: item.descricao || '',
    }));
    tr.appendChild(celulaCampo('num', {
      className: 'field field-num item-campo', name: 'quantidade', formId: formId,
      label: 'Quantidade', value: inputBr(item.quantidade, 0), inputmode: 'decimal',
    }));
    tr.appendChild(celulaCampo('num', {
      className: 'field field-num item-campo', name: 'preco_usd', formId: formId,
      label: 'Unit USD', value: inputBr(item.preco_usd, 2), inputmode: 'decimal',
    }));
    tr.appendChild(tdAmount);
    tr.appendChild(celulaCampo('col-hide-sm', {
      className: 'field mono item-campo', name: 'ncm', formId: formId,
      label: 'NCM', value: item.ncm || '', inputmode: 'numeric', mono: true,
    }));
    tr.appendChild(celula('', acoes));
    return tr;
  }

  function camposDoForm(formEl) {
    return document.querySelectorAll('[form="' + formEl.id + '"]');
  }

  /** Após salvar, o valor gravado vira o novo "original" (usado para desfazer no 409). */
  function fixarValores(formEl, item) {
    var tr = formEl.closest('tr');
    var valores = {
      referencia: item.referencia || '',
      descricao: item.descricao || '',
      quantidade: inputBr(item.quantidade, 0),
      preco_usd: inputBr(item.preco_usd, 2),
      ncm: item.ncm || '',
    };
    camposDoForm(formEl).forEach(function (el) {
      if (!(el.name in valores)) return;
      el.value = valores[el.name];
      el.defaultValue = valores[el.name];
    });
    if (!tr) return;
    tr.querySelectorAll('.item-valor').forEach(function (span) {
      var campo = span.getAttribute('data-campo');
      if (campo in valores) span.textContent = textoValor(valores[campo]);
    });
    var amount = tr.querySelector('[data-amount]');
    if (amount) amount.textContent = moneyUsd(item.amount_usd);
    var aCmp = tr.querySelector('a.link-action');
    if (aCmp) aCmp.href = linkComparativo(item.referencia);
  }

  function desfazerValores(formEl, nomes) {
    camposDoForm(formEl).forEach(function (el) {
      if (nomes.indexOf(el.name) !== -1) el.value = el.defaultValue;
    });
  }

  var CAMPOS_ITEM = ['referencia', 'descricao', 'quantidade', 'preco_usd', 'ncm'];

  function mostrarEdicao(tr, editando) {
    tr.classList.toggle('is-editing', editando);
    tr.querySelectorAll('.item-valor').forEach(function (el) { el.hidden = editando; });
    tr.querySelectorAll('.item-campo').forEach(function (el) { el.hidden = !editando; });
    var formEl = tr.querySelector('.form-editar-item');
    if (formEl) formEl.hidden = !editando;
    var btnEditar = tr.querySelector('.btn-editar-item');
    if (btnEditar) btnEditar.setAttribute('aria-expanded', editando ? 'true' : 'false');
  }

  /** Fecha a linha descartando o que não foi salvo (volta ao defaultValue). */
  function fecharLinha(tr) {
    var formEl = tr.querySelector('.form-editar-item');
    if (formEl) desfazerValores(formEl, CAMPOS_ITEM);
    mostrarEdicao(tr, false);
  }

  var FOLGA_SCROLL_PX = 8;

  /** A tabela rola na horizontal: traz Salvar/Cancelar para dentro da área visível. */
  function manterAcoesVisiveis(tr) {
    var scroller = tr.closest('.table-panel');
    var formEl = tr.querySelector('.form-editar-item');
    if (!scroller || !formEl) return;
    var area = scroller.getBoundingClientRect();
    var acoes = formEl.getBoundingClientRect();
    var sobraDireita = acoes.right - area.right + FOLGA_SCROLL_PX;
    if (sobraDireita > 0) scroller.scrollLeft += sobraDireita;
  }

  function abrirLinha(tr) {
    if (tr.classList.contains('is-editing')) return;
    painel.querySelectorAll('tr.item-edit.is-editing').forEach(fecharLinha);
    mostrarEdicao(tr, true);
    var primeiro = tr.querySelector('.item-campo');
    if (primeiro) primeiro.focus({ preventScroll: true });
    manterAcoesVisiveis(tr);
  }

  painel.addEventListener('click', function (ev) {
    var btnEditar = ev.target.closest('.btn-editar-item');
    if (btnEditar && painel.contains(btnEditar)) {
      if (submitting) return;
      abrirLinha(btnEditar.closest('tr'));
      return;
    }
    var btnCancelar = ev.target.closest('.btn-cancelar-item');
    if (btnCancelar && painel.contains(btnCancelar)) {
      if (submitting) return;
      fecharLinha(btnCancelar.closest('tr'));
      setStatus('');
    }
  });

  async function parseJsonRes(res) {
    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok || !data || data.ok === false) {
      var msg = (data && data.erro) || 'Não foi possível concluir a operação.';
      var err = new Error(msg);
      err.status = res.status;
      err.codigo = data && data.codigo;
      throw err;
    }
    return data;
  }

  /** FormData vira multipart; o Express deste app só parseia urlencoded. */
  function formBody(formEl) {
    return new URLSearchParams(new FormData(formEl));
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (submitting) return;

    var referencia = String((form.querySelector('#referencia') || {}).value || '').trim();
    if (!referencia) {
      setStatus('Informe a REF do item.', true);
      var refEl = form.querySelector('#referencia');
      if (refEl) refEl.focus();
      return;
    }

    submitting = true;
    if (btnAdd) {
      btnAdd.disabled = true;
      btnAdd.textContent = 'Adicionando…';
    }
    setStatus('');

    try {
      var res = await fetch(form.action, {
        method: 'POST',
        body: formBody(form),
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      var data = await parseJsonRes(res);
      if (data.item && tbody) {
        tbody.appendChild(montarLinha(data.item));
      }
      atualizarBadge(data.qtdItens);
      atualizarSaldo(data.saldo);
      limparFormProduto();
      setStatus('Item adicionado.', false);
      focarProximo();
    } catch (err) {
      setStatus(err.message || 'Erro ao adicionar item.', true);
    } finally {
      submitting = false;
      if (btnAdd) {
        btnAdd.disabled = false;
        btnAdd.textContent = 'Adicionar item';
      }
    }
  });

  painel.addEventListener('submit', async function (ev) {
    var editForm = ev.target.closest('.form-editar-item');
    if (!editForm || !painel.contains(editForm)) return;
    ev.preventDefault();
    if (submitting) return;

    var refEl = document.querySelector('[form="' + editForm.id + '"][name="referencia"]');
    if (refEl && !refEl.value.trim()) {
      setStatus('Informe a REF do item.', true);
      refEl.focus();
      return;
    }

    var btn = editForm.querySelector('button[type="submit"]');
    submitting = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvando…';
    }
    setStatus('');

    try {
      var res = await fetch(editForm.action, {
        method: 'POST',
        body: formBody(editForm),
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      var data = await parseJsonRes(res);
      if (data.item) fixarValores(editForm, data.item);
      var trEditada = editForm.closest('tr');
      if (trEditada) mostrarEdicao(trEditada, false);
      atualizarBadge(data.qtdItens);
      atualizarSaldo(data.saldo);
      setStatus('Item atualizado.', false);
    } catch (err) {
      if (err.codigo === 'ITEM_COBERTO') {
        desfazerValores(editForm, ['quantidade', 'preco_usd']);
        aplicarTrava(true);
      }
      setStatus(err.message || 'Erro ao salvar item.', true);
    } finally {
      submitting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salvar';
      }
    }
  });

  painel.addEventListener('submit', async function (ev) {
    var remForm = ev.target.closest('.form-remover-item');
    if (!remForm || !painel.contains(remForm)) return;
    ev.preventDefault();
    if (!confirm('Remover item?')) return;
    if (submitting) return;

    submitting = true;
    try {
      var res = await fetch(remForm.action, {
        method: 'POST',
        body: formBody(remForm),
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      var data = await parseJsonRes(res);
      var row = remForm.closest('tr');
      if (row) row.remove();
      atualizarBadge(data.qtdItens);
      atualizarSaldo(data.saldo);
      setStatus('Item removido.', false);
    } catch (err) {
      setStatus(err.message || 'Erro ao remover item.', true);
    } finally {
      submitting = false;
    }
  });
})();
