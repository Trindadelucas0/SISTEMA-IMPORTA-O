/**
 * Busca da listagem de produtos: sugestões case-insensitive,
 * abrem ao digitar (1+ caracteres), fecham no mouseleave,
 * reabrem só com clique no input ou nova digitação.
 */
(function () {
  var MAX_SUGESTOES = 8;

  function normalize(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function init() {
    var form = document.getElementById('form-produtos-busca');
    if (!form) return;

    var input = form.querySelector('#q');
    var control = form.querySelector('.produtos-busca-control');
    var list = document.getElementById('produtos-suggest-list');
    var dataEl = document.getElementById('produtos-sugestoes-data');
    if (!input || !control || !list || !dataEl) return;

    var produtos = [];
    try {
      produtos = JSON.parse(dataEl.textContent || '[]');
    } catch (e) {
      produtos = [];
    }

    var activeIndex = -1;
    var filtered = [];

    function closeList() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
    }

    function openList() {
      if (!filtered.length && !input.value.trim()) {
        closeList();
        return;
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function renderList() {
      list.innerHTML = '';
      if (!filtered.length) {
        var empty = document.createElement('li');
        empty.className = 'produto-combobox-empty';
        empty.textContent = 'Nenhum produto encontrado.';
        list.appendChild(empty);
        return;
      }
      filtered.forEach(function (produto, index) {
        var item = document.createElement('li');
        item.className =
          'produto-combobox-item' + (index === activeIndex ? ' is-active' : '');
        item.setAttribute('role', 'option');
        item.dataset.index = String(index);
        item.innerHTML =
          '<span class="produto-combobox-item-nome"></span>' +
          '<span class="produto-combobox-item-codigo mono"></span>';
        item.querySelector('.produto-combobox-item-nome').textContent = produto.nome;
        item.querySelector('.produto-combobox-item-codigo').textContent =
          produto.codigo_interno;
        item.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
          selecionar(produto);
        });
        list.appendChild(item);
      });
    }

    function filtrar(termo) {
      var alvo = normalize(termo);
      if (!alvo) {
        filtered = [];
        activeIndex = -1;
        renderList();
        return;
      }
      filtered = produtos
        .filter(function (p) {
          return (
            normalize(p.nome).indexOf(alvo) !== -1 ||
            normalize(p.codigo_interno).indexOf(alvo) !== -1
          );
        })
        .slice(0, MAX_SUGESTOES);
      activeIndex = filtered.length ? 0 : -1;
      renderList();
    }

    function selecionar(produto) {
      input.value = produto.nome || '';
      closeList();
      form.submit();
    }

    function tentarAbrir() {
      var termo = input.value.trim();
      if (!termo) {
        closeList();
        return;
      }
      filtrar(termo);
      openList();
    }

    input.addEventListener('input', function () {
      var termo = input.value.trim();
      if (!termo) {
        closeList();
        return;
      }
      filtrar(termo);
      openList();
    });

    input.addEventListener('click', function () {
      tentarAbrir();
    });

    input.addEventListener('focus', function () {
      // Só reabre se já houver texto (não lista tudo no foco vazio)
      tentarAbrir();
    });

    input.addEventListener('keydown', function (ev) {
      if (list.hidden && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
        tentarAbrir();
        return;
      }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (activeIndex < filtered.length - 1) activeIndex += 1;
        renderList();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (activeIndex > 0) activeIndex -= 1;
        renderList();
      } else if (ev.key === 'Enter') {
        if (!list.hidden && activeIndex >= 0 && filtered[activeIndex]) {
          ev.preventDefault();
          selecionar(filtered[activeIndex]);
        }
      } else if (ev.key === 'Escape') {
        closeList();
      }
    });

    control.addEventListener('mouseleave', function () {
      closeList();
    });

    document.addEventListener('pointerdown', function (ev) {
      if (!control.contains(ev.target)) closeList();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
