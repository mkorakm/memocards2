// chat.js — чат технической поддержки MemoCards:
// отправка сообщений, индикатор набора, вложения, быстрые ответы,
// поиск по истории, потеря соединения, список обращений, оценка качества.
//
// Ответы "оператора" здесь имитируются на фронтенде (учебный прототип).
// В настоящем приложении сообщения передаются на сервер (например, по WebSocket).

(function () {
  'use strict';

  var toast = (window.MemoCards && window.MemoCards.toast) || function () {};
  var MAX_SIZE = 5 * 1024 * 1024;                       // 5 МБ
  var ALLOWED = ['png', 'jpg', 'jpeg', 'pdf', 'txt', 'zip'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function nowTime() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function fmtSize(b) {
    if (b < 1024) return b + ' Б';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' КБ';
    return (b / 1024 / 1024).toFixed(1) + ' МБ';
  }

  // ======================= ЧАТ =======================
  var log = document.querySelector('[data-log]');
  var composer = document.querySelector('[data-composer]');

  function scrollDown() { if (log) log.scrollTop = log.scrollHeight; }

  if (log) {
    scrollDown();

    var input = composer ? composer.querySelector('textarea') : null;
    var sendBtn = composer ? composer.querySelector('.composer__send') : null;
    var fileInput = document.querySelector('[data-file]');
    var pending = document.querySelector('[data-pending]');
    var attachments = [];            // {ok, file, url, name, size, error}
    var online = navigator.onLine !== false;

    // ---------- поле ввода ----------
    function autosize() {
      if (!input) return;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 132) + 'px';
    }
    function sendable() {
      return !!(input && input.value.trim()) || attachments.some(function (a) { return a.ok; });
    }
    function updateSend() { if (sendBtn) sendBtn.disabled = !sendable(); }

    if (input) {
      input.addEventListener('input', function () { autosize(); updateSend(); });
      input.addEventListener('keydown', function (e) {
        // Enter — отправить, Shift+Enter — новая строка
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (sendable()) composer.requestSubmit();
        }
      });
      autosize();
    }

    // ---------- вложения ----------
    function checkFile(file) {
      var ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ALLOWED.indexOf(ext) === -1) return 'Формат не поддерживается. Разрешены PNG, JPG, PDF, TXT, ZIP';
      if (file.size > MAX_SIZE) return 'Файл слишком большой — максимум 5 МБ';
      return '';
    }
    function renderPending() {
      if (!pending) return;
      pending.innerHTML = '';
      attachments.forEach(function (a, i) {
        var box = el('div', 'attach' + (a.ok ? '' : ' attach--error'));
        var thumb = el('div', 'attach__thumb' + (a.url ? '' : ' attach__thumb--file'), a.url ? '' : (a.ok ? '📄' : '⚠'));
        if (a.url) thumb.style.backgroundImage = 'url(' + a.url + ')';
        var body = el('div', 'attach__body');
        body.appendChild(el('div', 'attach__name', a.name));
        body.appendChild(el('div', 'attach__size', a.ok ? fmtSize(a.size) : a.error));
        var rm = el('button', 'attach__remove', '✕');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Убрать файл');
        rm.addEventListener('click', function () {
          attachments.splice(i, 1);
          renderPending(); updateSend();
        });
        box.appendChild(thumb); box.appendChild(body); box.appendChild(rm);
        pending.appendChild(box);
      });
      pending.hidden = attachments.length === 0;
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-action="attach"]') && fileInput) fileInput.click();
    });
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        Array.prototype.forEach.call(fileInput.files, function (file) {
          var err = checkFile(file);
          if (err) {
            attachments.push({ ok: false, name: file.name, error: err });
            toast('«' + file.name + '»: ' + err, 'error');
          } else {
            var isImg = /\.(png|jpe?g)$/i.test(file.name);
            attachments.push({ ok: true, name: file.name, size: file.size, url: isImg ? URL.createObjectURL(file) : '' });
          }
        });
        fileInput.value = '';
        renderPending(); updateSend();
      });
    }

    // ---------- сообщения ----------
    function opAvatar() {
      var a = el('div', 'avatar avatar--sm');
      a.appendChild(el('span', '', 'А'));
      return a;
    }
    function addUserMessage(text, files) {
      var row = el('div', 'msg msg--user');
      var col = el('div', 'msg__col');
      var bubble = el('div', 'msg__bubble');
      files.forEach(function (f) {
        if (f.url) {
          var img = el('div', 'bubble-img', f.name);
          img.style.backgroundImage = 'url(' + f.url + ')';
          img.style.backgroundSize = 'cover';
          bubble.appendChild(img);
        } else {
          bubble.appendChild(el('div', 'bubble-file', '📄 ' + f.name + ' · ' + fmtSize(f.size)));
        }
      });
      if (text) bubble.appendChild(el('p', 'msg__text', text));
      var meta = el('div', 'msg__meta');
      meta.appendChild(el('span', '', nowTime()));
      var ticks = el('span', 'msg__ticks', online ? '✓' : '');
      meta.appendChild(ticks);
      col.appendChild(bubble); col.appendChild(meta);
      row.appendChild(col);
      log.appendChild(row);
      scrollDown();

      if (!online) {                      // нет связи: сообщение не отправлено
        row.classList.add('msg--failed');
        ticks.textContent = 'Не отправлено';
        ticks.className = '';
        var retry = el('button', 'msg__retry', 'Повторить');
        retry.type = 'button';
        retry.setAttribute('data-action', 'retry');
        meta.appendChild(retry);
        return row;
      }
      setTimeout(function () { ticks.textContent = '✓✓'; }, 600);   // доставлено
      return row;
    }
    function addTyping() {
      var row = el('div', 'msg msg--operator');
      row.appendChild(opAvatar());
      var col = el('div', 'msg__col');
      var b = el('div', 'msg__bubble typing');
      b.setAttribute('aria-label', 'Оператор печатает');
      b.appendChild(el('i')); b.appendChild(el('i')); b.appendChild(el('i'));
      col.appendChild(b);
      col.appendChild(el('div', 'msg__meta', 'Анна печатает…'));
      row.appendChild(col);
      log.appendChild(row);
      scrollDown();
      return row;
    }
    function addOperatorMessage(text) {
      var row = el('div', 'msg msg--operator');
      row.appendChild(opAvatar());
      var col = el('div', 'msg__col');
      var b = el('div', 'msg__bubble');
      b.appendChild(el('p', 'msg__text', text));
      col.appendChild(b);
      col.appendChild(el('div', 'msg__meta', 'Анна · ' + nowTime()));
      row.appendChild(col);
      log.appendChild(row);
      scrollDown();
    }
    function addSystem(text, kind) {
      log.appendChild(el('div', 'sys' + (kind ? ' sys--' + kind : ''), text));
      scrollDown();
    }

    function replyFor(text) {
      var t = text.toLowerCase();
      if (t.indexOf('парол') !== -1) return 'Отправила вам ссылку для сброса пароля. Проверьте почту и папку «Спам».';
      if (t.indexOf('latex') !== -1 || t.indexOf('формул') !== -1) return 'Проверьте, что формула записана между знаками $ и все фигурные скобки закрыты. Если не поможет — пришлите скриншот.';
      if (t.indexOf('вход') !== -1 || t.indexOf('войти') !== -1) return 'Уточните, пожалуйста, какое сообщение вы видите при входе, и на какой email зарегистрирован аккаунт.';
      if (t.indexOf('соревн') !== -1) return 'Соревнование начинается в указанное время. Чтобы участвовать, войдите в аккаунт и нажмите «Участвовать».';
      return 'Спасибо за сообщение! Я передала запрос специалисту, ответим в ближайшее время.';
    }

    function send(text) {
      var files = attachments.filter(function (a) { return a.ok; });
      text = (text || '').trim();
      if (!text && !files.length) return;
      addUserMessage(text, files);
      if (input) { input.value = ''; autosize(); }
      attachments = []; renderPending(); updateSend();
      if (!online) return;
      setTimeout(function () {
        var typing = addTyping();
        setTimeout(function () {
          typing.remove();
          addOperatorMessage(replyFor(text || 'вложение'));
        }, 1700);
      }, 600);
    }

    if (composer) {
      composer.addEventListener('submit', function (e) {
        e.preventDefault();
        send(input.value);
      });
      updateSend();      // готовую разметку вложений не перерисовываем
    }

    // быстрые ответы
    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-quick]');
      if (chip) send(chip.dataset.quick || chip.textContent);
    });

    // повторная отправка неотправленного сообщения
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="retry"]');
      if (!btn) return;
      if (!online) { toast('Соединения всё ещё нет. Проверьте интернет и повторите', 'error'); return; }
      var row = btn.closest('.msg');
      row.classList.remove('msg--failed');
      var meta = btn.closest('.msg__meta');
      meta.innerHTML = '';
      meta.appendChild(el('span', '', nowTime()));
      meta.appendChild(el('span', 'msg__ticks', '✓✓'));
      toast('Сообщение отправлено', 'success');
    });

    // ---------- связь с сервером ----------
    var banner = document.querySelector('[data-conn]');
    window.addEventListener('offline', function () {
      online = false;
      if (banner) {
        banner.className = 'alert alert--error chat-banner';
        banner.innerHTML = '';
        banner.appendChild(el('span', 'alert__icon', '!'));
        var d = el('div');
        d.appendChild(el('div', 'alert__title', 'Нет соединения'));
        d.appendChild(el('div', 'alert__text', 'Сообщения не отправляются. Пытаемся подключиться заново…'));
        banner.appendChild(d);
        banner.hidden = false;
      }
      addSystem('Соединение потеряно', 'error');
    });
    window.addEventListener('online', function () {
      online = true;
      if (banner) banner.hidden = true;
      addSystem('Соединение восстановлено', 'ok');
    });

    // ---------- поиск по истории ----------
    var search = document.querySelector('[data-search]');
    if (search) {
      var sInput = search.querySelector('input');
      var sCount = search.querySelector('[data-search-count]');
      var sEmpty = document.querySelector('[data-search-empty]');
      var matches = [], idx = -1;

      var clearMarks = function () {
        log.querySelectorAll('mark.hl').forEach(function (m) {
          var p = m.parentNode;
          p.replaceChild(document.createTextNode(m.textContent), m);
          p.normalize();
        });
      };
      var highlight = function (root, re) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (n) {
          var text = n.nodeValue, last = 0, m, frag = document.createDocumentFragment();
          re.lastIndex = 0;
          if (!re.test(text)) return;
          re.lastIndex = 0;
          while ((m = re.exec(text))) {
            frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            var mk = el('mark', 'hl', m[0]);
            frag.appendChild(mk);
            last = m.index + m[0].length;
          }
          frag.appendChild(document.createTextNode(text.slice(last)));
          n.parentNode.replaceChild(frag, n);
        });
      };
      var show = function () {
        matches.forEach(function (m, i) { m.classList.toggle('is-current', i === idx); });
        if (matches[idx]) matches[idx].scrollIntoView({ block: 'center' });
        var q = sInput.value.trim();
        sCount.textContent = q ? (matches.length ? (idx + 1) + ' из ' + matches.length : '0 из 0') : '';
        if (sEmpty) sEmpty.hidden = !(q && !matches.length);
      };
      var run = function () {
        clearMarks();
        var q = sInput.value.trim();
        matches = []; idx = -1;
        if (q) {
          var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          log.querySelectorAll('.msg__text').forEach(function (t) { highlight(t, re); });
          matches = Array.prototype.slice.call(log.querySelectorAll('mark.hl'));
          if (matches.length) idx = matches.length - 1;   // начинаем с самых новых
        }
        show();
      };
      var step = function (d) {
        if (!matches.length) return;
        idx = (idx + d + matches.length) % matches.length;
        show();
      };
      sInput.addEventListener('input', run);
      sInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? 1 : -1); }
        if (e.key === 'Escape') closeSearch();
      });
      search.querySelector('[data-search-prev]').addEventListener('click', function () { step(1); });
      search.querySelector('[data-search-next]').addEventListener('click', function () { step(-1); });

      var closeSearch = function () {
        sInput.value = ''; run();
        search.hidden = true;
        if (sEmpty) sEmpty.hidden = true;
      };
      search.querySelector('[data-action="chat-search-close"]').addEventListener('click', closeSearch);
      document.addEventListener('click', function (e) {
        if (e.target.closest('[data-action="chat-search"]')) {
          search.hidden = false;
          sInput.focus();
        }
      });
    }

    // завершить чат -> экран завершения с оценкой
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-action="end-chat"]')) window.location.href = 'chat-closed.html';
    });
  }

  // ======================= СПИСОК ОБРАЩЕНИЙ =======================
  var tickets = document.querySelectorAll('.ticket[data-status]');
  if (tickets.length) {
    var tSearch = document.querySelector('[data-ticket-search]');
    var tChips = document.querySelectorAll('[data-filter]');
    var tCount = document.querySelector('[data-count]');
    var tEmpty = document.querySelector('[data-empty]');
    var tFilter = 'all';

    var applyTickets = function () {
      var q = tSearch ? tSearch.value.trim().toLowerCase() : '';
      var shown = 0;
      tickets.forEach(function (t) {
        var okStatus = tFilter === 'all' || t.dataset.status === tFilter;
        var okText = !q || t.textContent.toLowerCase().indexOf(q) !== -1;
        t.hidden = !(okStatus && okText);
        if (!t.hidden) shown++;
      });
      if (tCount) tCount.textContent = 'Найдено: ' + shown;
      if (tEmpty) tEmpty.hidden = shown > 0;
    };
    tChips.forEach(function (c) {
      c.addEventListener('click', function () {
        tChips.forEach(function (x) { x.classList.remove('is-selected'); });
        c.classList.add('is-selected');
        tFilter = c.dataset.filter;
        applyTickets();
      });
    });
    if (tSearch) tSearch.addEventListener('input', applyTickets);
    applyTickets();
  }

  // ======================= ОЦЕНКА КАЧЕСТВА =======================
  var rateForm = document.querySelector('[data-form="rating"]');
  if (rateForm) {
    var LABELS = ['Выберите оценку', 'Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично'];
    var stars = rateForm.querySelectorAll('.star');
    var label = rateForm.querySelector('[data-rating-label]');
    var field = rateForm.querySelector('[data-field="rating"]');
    var fieldErr = field.querySelector('.field__error');
    var banner2 = rateForm.querySelector('[data-alert]');
    var area = rateForm.querySelector('textarea');
    var counter = rateForm.querySelector('[data-counter]');
    var value = 0;

    var paint = function (v) {
      stars.forEach(function (s, i) {
        s.classList.toggle('is-on', i < v);
        s.setAttribute('aria-checked', String(i + 1 === value));
      });
      label.textContent = LABELS[v];
    };
    stars.forEach(function (s, i) {
      s.addEventListener('click', function () {
        value = i + 1;
        paint(value);
        field.classList.remove('has-error');
        fieldErr.hidden = true;
        if (banner2) banner2.hidden = true;
      });
      s.addEventListener('mouseenter', function () { paint(i + 1); });
      s.addEventListener('mouseleave', function () { paint(value); });
    });
    rateForm.querySelectorAll('[data-tag]').forEach(function (t) {
      t.addEventListener('click', function () { t.classList.toggle('is-selected'); });
    });
    if (area && counter) {
      area.addEventListener('input', function () { counter.textContent = area.value.length + ' / 500'; });
    }

    rateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!value) {                       // ошибка пользователя: оценка не выбрана
        field.classList.add('has-error');
        fieldErr.hidden = false;
        if (banner2) {
          banner2.className = 'alert alert--error';
          banner2.innerHTML = '';
          banner2.appendChild(el('span', 'alert__icon', '!'));
          var d = el('div');
          d.appendChild(el('div', 'alert__title', 'Не удалось отправить отзыв'));
          d.appendChild(el('div', 'alert__text', 'Поставьте оценку от 1 до 5 звёзд.'));
          banner2.appendChild(d);
          banner2.hidden = false;
        }
        rateForm.querySelector('.star').focus();
        return;
      }
      try {
        var all = JSON.parse(localStorage.getItem('memocards_ratings') || '[]');
        all.push({
          value: value,
          tags: Array.prototype.map.call(rateForm.querySelectorAll('[data-tag].is-selected'), function (t) { return t.textContent; }),
          comment: area ? area.value.trim() : '',
          date: new Date().toISOString()
        });
        localStorage.setItem('memocards_ratings', JSON.stringify(all));
      } catch (err) {}
      window.location.href = 'chat-rating-thanks.html';
    });
  }
})();
