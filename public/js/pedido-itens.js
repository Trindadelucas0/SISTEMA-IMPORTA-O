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

  function montarLinha(item) {
    var tr = document.createElement('tr');
    tr.className = 'align-top';
    tr.setAttribute('data-item-id', String(item.id));

    var tdRef = document.createElement('td');
    tdRef.className = 'font-medium mono';
    var aRef = document.createElement('a');
    aRef.className = 'link-action';
    aRef.href = '/analises/comparativo/item/' + encodeURIComponent(item.referencia);
    aRef.title = 'Ver análise vs última compra';
    aRef.textContent = item.referencia;
    tdRef.appendChild(aRef);

    var tdDesc = document.createElement('td');
    tdDesc.className = 'max-w-xs whitespace-normal text-xs col-hide-sm';
    tdDesc.style.color = 'var(--muted)';
    tdDesc.textContent = item.descricao || '—';

    var tdQtd = document.createElement('td');
    tdQtd.className = 'num';
    tdQtd.textContent = numberBr(item.quantidade, 0);

    var tdPreco = document.createElement('td');
    tdPreco.className = 'num';
    tdPreco.textContent = numberBr(item.preco_usd, 2);

    var tdAmount = document.createElement('td');
    tdAmount.className = 'num font-semibold';
    tdAmount.textContent = moneyUsd(item.amount_usd);

    var tdNcm = document.createElement('td');
    tdNcm.className = 'mono col-hide-sm';
    tdNcm.textContent = item.ncm || '—';

    var tdAcoes = document.createElement('td');
    tdAcoes.className = 'text-right space-x-2';
    var aCmp = document.createElement('a');
    aCmp.className = 'link-action';
    aCmp.href = '/analises/comparativo/item/' + encodeURIComponent(item.referencia);
    aCmp.textContent = 'vs última';

    var formRemover = document.createElement('form');
    formRemover.className = 'inline form-remover-item';
    formRemover.method = 'POST';
    formRemover.action = '/pedidos/' + pedidoId + '/itens/' + item.id + '?_method=DELETE';
    var btnRemover = document.createElement('button');
    btnRemover.type = 'submit';
    btnRemover.className = 'link-danger';
    btnRemover.textContent = 'Remover';
    formRemover.appendChild(btnRemover);

    tdAcoes.appendChild(aCmp);
    tdAcoes.appendChild(formRemover);

    tr.appendChild(tdRef);
    tr.appendChild(tdDesc);
    tr.appendChild(tdQtd);
    tr.appendChild(tdPreco);
    tr.appendChild(tdAmount);
    tr.appendChild(tdNcm);
    tr.appendChild(tdAcoes);
    return tr;
  }

  async function parseJsonRes(res) {
    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok || !data || data.ok === false) {
      var msg = (data && data.erro) || 'Não foi possível concluir a operação.';
      throw new Error(msg);
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
