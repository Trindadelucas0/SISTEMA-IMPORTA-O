(function () {
  function clearMenu(menu) {
    if (!menu) return;
    menu.classList.remove('is-fixed');
    menu.style.top = '';
    menu.style.left = '';
    menu.style.minWidth = '';
  }

  function placeMenu(details) {
    var summary = details.querySelector('summary');
    var menu = details.querySelector('.status-picker-menu');
    if (!summary || !menu) return;

    var rect = summary.getBoundingClientRect();
    var minW = Math.max(rect.width, 136);
    var left = rect.left;
    var top = rect.bottom + 4;
    var menuH = menu.offsetHeight || 120;

    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuH - 4);
    }
    if (left + minW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - minW - 8);
    }

    menu.classList.add('is-fixed');
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.minWidth = minW + 'px';
  }

  function closeAll(except) {
    document.querySelectorAll('details.status-picker[open]').forEach(function (el) {
      if (el === except) return;
      el.removeAttribute('open');
      clearMenu(el.querySelector('.status-picker-menu'));
    });
  }

  document.addEventListener(
    'toggle',
    function (e) {
      var details = e.target;
      if (!details || !details.classList || !details.classList.contains('status-picker')) return;
      var menu = details.querySelector('.status-picker-menu');
      if (!details.open) {
        clearMenu(menu);
        return;
      }
      closeAll(details);
      placeMenu(details);
      requestAnimationFrame(function () {
        if (details.open) placeMenu(details);
      });
    },
    true
  );

  function onReposition() {
    document.querySelectorAll('details.status-picker[open]').forEach(function (details) {
      placeMenu(details);
    });
  }

  window.addEventListener('resize', onReposition);
  window.addEventListener('scroll', onReposition, true);
})();
