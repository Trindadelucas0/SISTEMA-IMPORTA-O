/**
 * Combobox pesquisável de produtos (sem dependências externas).
 * Busca case-insensitive por nome ou código interno, navegação por teclado,
 * e fecha a lista ao selecionar, ao sair com o mouse ou ao clicar fora.
 */
(function () {
  function normalize(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function init(container) {
    const input = container.querySelector('.produto-combobox-input');
    const list = container.querySelector('.produto-combobox-list');
    const clearBtn = container.querySelector('.produto-combobox-clear');
    const dataEl = container.querySelector('.produto-combobox-data');
    if (!input || !list || !dataEl) return;

    let produtos = [];
    try {
      produtos = JSON.parse(dataEl.textContent || '[]');
    } catch (e) {
      produtos = [];
    }

    const fieldIds = {
      referencia: container.dataset.targetReferencia || 'referencia',
      descricao: container.dataset.targetDescricao || 'descricao',
      ncm: container.dataset.targetNcm || 'ncm',
      preco: container.dataset.targetPreco || 'preco_usd',
    };
    const form = input.closest('form');
    const field = (name) => form && form.querySelector('#' + fieldIds[name]);

    let activeIndex = -1;
    let filtered = produtos;

    function closeList() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
    }

    function openList() {
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function renderList() {
      list.innerHTML = '';
      if (!filtered.length) {
        const empty = document.createElement('li');
        empty.className = 'produto-combobox-empty';
        empty.textContent = 'Nenhum produto encontrado.';
        list.appendChild(empty);
        return;
      }
      filtered.forEach(function (produto, index) {
        const item = document.createElement('li');
        item.className = 'produto-combobox-item' + (index === activeIndex ? ' is-active' : '');
        item.setAttribute('role', 'option');
        item.dataset.index = String(index);
        item.innerHTML =
          '<span class="produto-combobox-item-nome"></span>' +
          '<span class="produto-combobox-item-codigo mono"></span>';
        item.querySelector('.produto-combobox-item-nome').textContent = produto.nome;
        item.querySelector('.produto-combobox-item-codigo').textContent = produto.codigo_interno;
        item.addEventListener('mousedown', function (ev) {
          // mousedown (não click) evita perder o foco antes do blur do input
          ev.preventDefault();
          selecionar(produto);
        });
        list.appendChild(item);
      });
    }

    function filtrar(termo) {
      const alvo = normalize(termo);
      filtered = !alvo
        ? produtos
        : produtos.filter(function (p) {
            return normalize(p.nome).includes(alvo) || normalize(p.codigo_interno).includes(alvo);
          });
      activeIndex = filtered.length ? 0 : -1;
      renderList();
    }

    function selecionar(produto) {
      input.value = produto.nome;
      clearBtn.hidden = false;

      const refField = field('referencia');
      const descField = field('descricao');
      const ncmField = field('ncm');
      const precoField = field('preco');

      if (refField) refField.value = produto.nome || '';
      if (descField) descField.value = produto.codigo_interno || '';
      if (ncmField && produto.ncm) ncmField.value = produto.ncm;
      if (precoField && produto.preco_usd_formatado) precoField.value = produto.preco_usd_formatado;

      closeList();
    }

    input.addEventListener('input', function () {
      clearBtn.hidden = !input.value;
      filtrar(input.value);
      openList();
    });

    input.addEventListener('focus', function () {
      filtrar(input.value);
      openList();
    });

    input.addEventListener('keydown', function (ev) {
      if (list.hidden && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
        filtrar(input.value);
        openList();
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

    clearBtn.addEventListener('click', function () {
      input.value = '';
      clearBtn.hidden = true;
      filtrar('');
      input.focus();
    });

    container.addEventListener('mouseleave', function () {
      closeList();
    });

    document.addEventListener('pointerdown', function (ev) {
      if (!container.contains(ev.target)) closeList();
    });

    filtrar('');
  }

  function initAll() {
    document.querySelectorAll('.produto-combobox').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
