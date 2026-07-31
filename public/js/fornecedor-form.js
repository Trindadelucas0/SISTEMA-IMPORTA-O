/**
 * Formulário de fornecedor: máscara CNPJ/CEP + busca BrasilAPI (debounce).
 */
(function () {
  var form = document.getElementById('form-fornecedor');
  if (!form) return;

  var cnpjEl = document.getElementById('cnpj');
  var cepEl = document.getElementById('cep');
  var btnBuscar = document.getElementById('btn-buscar-cnpj');
  var statusEl = document.getElementById('cnpj-status');
  var btnSalvar = document.getElementById('btn-salvar-fornecedor');

  var lastFetched = '';
  var abortCtrl = null;
  var debounceTimer = null;
  var submitting = false;

  function onlyDigits(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function formatCnpj(v) {
    var d = onlyDigits(v).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
    if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
    if (d.length <= 12) {
      return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
    }
    return (
      d.slice(0, 2) +
      '.' +
      d.slice(2, 5) +
      '.' +
      d.slice(5, 8) +
      '/' +
      d.slice(8, 12) +
      '-' +
      d.slice(12)
    );
  }

  function formatCep(v) {
    var d = onlyDigits(v).slice(0, 8);
    if (d.length <= 5) return d;
    return d.slice(0, 5) + '-' + d.slice(5);
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    if (!msg) {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
      return;
    }
    statusEl.style.display = 'block';
    statusEl.textContent = msg;
    statusEl.className = 'field-hint ' + (isError ? 'text-bad' : 'text-ok');
  }

  function fillIfEmpty(id, value) {
    var el = document.getElementById(id);
    if (!el || value == null || value === '') return;
    if (!String(el.value || '').trim()) el.value = value;
  }

  function fillAlways(id, value) {
    var el = document.getElementById(id);
    if (!el || value == null || value === '') return;
    el.value = value;
  }

  function applyCnpjData(data, jaCadastrado) {
    fillAlways('razao_social', data.razao_social);
    fillAlways('nome_fantasia', data.nome_fantasia);
    fillIfEmpty('nome', data.nome);
    fillAlways('email', data.email);
    fillAlways('telefone', data.telefone);
    fillAlways('cep', data.cep ? formatCep(data.cep) : '');
    fillAlways('logradouro', data.logradouro);
    fillAlways('numero', data.numero);
    fillAlways('complemento', data.complemento);
    fillAlways('bairro', data.bairro);
    fillAlways('cidade', data.cidade);
    fillAlways('uf', data.uf);
    fillIfEmpty('pais', data.pais || 'Brasil');

    if (jaCadastrado) {
      setStatus(
        'Dados preenchidos. Atenção: CNPJ já cadastrado como “' +
          jaCadastrado.nome +
          '”.',
        true
      );
    } else {
      setStatus('Dados do CNPJ preenchidos.', false);
    }
  }

  async function buscarCnpj(force) {
    if (!cnpjEl) return;
    var cnpj = onlyDigits(cnpjEl.value);
    if (cnpj.length !== 14) {
      setStatus('Digite os 14 dígitos do CNPJ para buscar.', true);
      return;
    }
    if (!force && cnpj === lastFetched) return;

    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();

    if (btnBuscar) {
      btnBuscar.disabled = true;
      btnBuscar.textContent = 'Buscando…';
    }
    setStatus('Consultando CNPJ…', false);

    try {
      var res = await fetch('/fornecedores/api/cnpj/' + cnpj, {
        headers: { Accept: 'application/json' },
        signal: abortCtrl.signal,
      });
      var json = await res.json().catch(function () {
        return { ok: false, error: 'Resposta inválida do servidor.' };
      });
      if (!json.ok) {
        setStatus(json.error || 'Não foi possível consultar o CNPJ.', true);
        return;
      }
      lastFetched = cnpj;
      applyCnpjData(json.data, json.jaCadastrado);
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      setStatus('Falha de rede ao consultar CNPJ.', true);
    } finally {
      if (btnBuscar) {
        btnBuscar.disabled = false;
        btnBuscar.textContent = 'Buscar';
      }
    }
  }

  if (cnpjEl) {
    cnpjEl.addEventListener('input', function () {
      var start = cnpjEl.selectionStart;
      var before = cnpjEl.value;
      cnpjEl.value = formatCnpj(cnpjEl.value);
      if (document.activeElement === cnpjEl && typeof start === 'number') {
        var delta = cnpjEl.value.length - before.length;
        cnpjEl.setSelectionRange(start + delta, start + delta);
      }

      var digits = onlyDigits(cnpjEl.value);
      clearTimeout(debounceTimer);
      if (digits.length === 14) {
        debounceTimer = setTimeout(function () {
          buscarCnpj(false);
        }, 450);
      } else {
        lastFetched = '';
        setStatus('', false);
      }
    });
  }

  if (cepEl) {
    cepEl.addEventListener('input', function () {
      cepEl.value = formatCep(cepEl.value);
    });
  }

  if (btnBuscar) {
    btnBuscar.addEventListener('click', function () {
      buscarCnpj(true);
    });
  }

  form.addEventListener('submit', function (ev) {
    if (submitting) {
      ev.preventDefault();
      return;
    }
    submitting = true;
    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando…';
    }
  });
})();
