// main.js — MemoCards: темы, уведомления, формы с проверкой ошибок,
// вход/регистрация (демо на localStorage), каталог (фильтр/сортировка), кнопки.
//
// ВАЖНО: пользователи хранятся в localStorage браузера — это учебная
// демонстрация фронтенда. В настоящем приложении регистрация и проверка
// пароля выполняются на сервере, пароли не хранят в открытом виде.

(function () {
  'use strict';

  // ---------- хранилище ----------
  var KEY_USERS = 'memocards_users';
  var KEY_SESSION = 'memocards_session';
  var KEY_THEME = 'memocards_theme';
  var KEY_FLASH = 'memocards_flash';

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* хранилище недоступно */ }
  }
  function getUsers() { return readJSON(KEY_USERS, []); }
  function currentUser() {
    var email = readJSON(KEY_SESSION, null);
    return getUsers().filter(function (u) { return u.email === email; })[0] || null;
  }

  // ---------- уведомления (toast) ----------
  function toast(message, type) {
    type = type || 'info';
    var box = document.querySelector('.toast-container');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toast-container';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    var icons = { success: '✓', error: '!', info: 'i' };
    var el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = '<span class="toast__icon"></span><span class="toast__text"></span>';
    el.querySelector('.toast__icon').textContent = icons[type];
    el.querySelector('.toast__text').textContent = message;
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 260);
    }, 3800);
  }

  // уведомление, которое нужно показать после перехода на другую страницу
  function flash(message, type) {
    try { sessionStorage.setItem(KEY_FLASH, JSON.stringify({ message: message, type: type })); } catch (e) {}
  }
  function showFlash() {
    try {
      var raw = sessionStorage.getItem(KEY_FLASH);
      if (!raw) return;
      sessionStorage.removeItem(KEY_FLASH);
      var f = JSON.parse(raw);
      toast(f.message, f.type);
    } catch (e) {}
  }

  // ---------- цветовые темы ----------
  var THEMES = [
    { id: 'rose', name: 'Розовая' },
    { id: 'dark', name: 'Тёмная' },
    { id: 'ocean', name: 'Морская' }
  ];

  function currentThemeId() {
    return document.documentElement.getAttribute('data-theme') || 'rose';
  }
  function markThemeButtons() {
    var id = currentThemeId();
    document.querySelectorAll('[data-theme-set]').forEach(function (btn) {
      btn.classList.toggle('is-selected', btn.dataset.themeSet === id);
    });
  }
  function setTheme(id, announce) {
    if (id === 'rose') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', id);
    try { localStorage.setItem(KEY_THEME, id); } catch (e) {}
    markThemeButtons();
    if (announce) {
      var t = THEMES.filter(function (x) { return x.id === id; })[0];
      toast('Тема оформления: ' + t.name, 'info');
    }
  }
  function cycleTheme() {
    var i = THEMES.map(function (t) { return t.id; }).indexOf(currentThemeId());
    setTheme(THEMES[(i + 1) % THEMES.length].id, true);
  }

  // ---------- состояние "вошёл / гость" ----------
  function renderSession() {
    var user = currentUser();
    document.querySelectorAll('[data-user-name]').forEach(function (el) {
      if (user) el.textContent = user.name;
    });
    document.querySelectorAll('[data-user-email]').forEach(function (el) {
      if (user) el.textContent = user.email;
    });
    document.querySelectorAll('[data-user-initial]').forEach(function (el) {
      if (user) el.textContent = user.name.charAt(0).toUpperCase();
    });
    document.querySelectorAll('[data-guest-only]').forEach(function (el) { el.hidden = !!user; });
    document.querySelectorAll('[data-user-only]').forEach(function (el) { el.hidden = !user; });
  }

  // ---------- ошибки форм ----------
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setFieldError(form, name, message) {
    var field = form.querySelector('[data-field="' + name + '"]');
    if (!field) return;
    var err = field.querySelector('.field__error');
    var input = field.querySelector('input');
    if (message) {
      field.classList.add('has-error');
      err.textContent = message;
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    } else {
      field.classList.remove('has-error');
      err.hidden = true;
      input.removeAttribute('aria-invalid');
    }
  }

  // баннер над формой: type = error | success | info
  function showAlert(form, type, title, text) {
    var box = form.querySelector('[data-alert]');
    if (!box) return;
    var icons = { error: '!', success: '✓', info: 'i' };
    box.className = 'alert alert--' + type;
    box.innerHTML = '<span class="alert__icon"></span><div><div class="alert__title"></div><div class="alert__text"></div></div>';
    box.querySelector('.alert__icon').textContent = icons[type];
    box.querySelector('.alert__title').textContent = title;
    box.querySelector('.alert__text').textContent = text || '';
    box.hidden = false;
  }
  function hideAlert(form) {
    var box = form.querySelector('[data-alert]');
    if (box) box.hidden = true;
  }

  // ошибка исчезает, как только пользователь начинает исправлять поле
  function clearOnInput(form) {
    form.querySelectorAll('input').forEach(function (input) {
      var evt = input.type === 'checkbox' ? 'change' : 'input';
      input.addEventListener(evt, function () {
        setFieldError(form, input.name, '');
      });
    });
  }

  function applyErrors(form, errors) {
    var names = Object.keys(errors);
    form.querySelectorAll('[data-field]').forEach(function (f) {
      setFieldError(form, f.dataset.field, errors[f.dataset.field] || '');
    });
    if (names.length) {
      var first = form.querySelector('[data-field="' + names[0] + '"] input');
      if (first) first.focus();
    }
    return names.length;
  }

  function plural(n, one, few, many) {
    var m = n % 10, h = n % 100;
    if (m === 1 && h !== 11) return one;
    if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return few;
    return many;
  }

  // ----- регистрация -----
  function initRegister(form) {
    clearOnInput(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim().toLowerCase();
      var pass = form.elements.password.value;
      var pass2 = form.elements.password2.value;
      var terms = form.elements.terms.checked;
      var errors = {};

      if (!name) errors.name = 'Введите имя';
      else if (name.length < 2) errors.name = 'Имя слишком короткое: минимум 2 символа';

      if (!email) errors.email = 'Введите email';
      else if (!EMAIL_RE.test(email)) errors.email = 'Некорректный email. Пример: name@mail.ru';
      else if (getUsers().some(function (u) { return u.email === email; })) {
        errors.email = 'Этот email уже зарегистрирован. Попробуйте войти';
      }

      if (!pass) errors.password = 'Придумайте пароль';
      else if (pass.length < 8) errors.password = 'Пароль слишком короткий: минимум 8 символов';
      else if (!/\d/.test(pass)) errors.password = 'Добавьте в пароль хотя бы одну цифру';

      if (!pass2) errors.password2 = 'Повторите пароль';
      else if (pass2 !== pass) errors.password2 = 'Пароли не совпадают';

      if (!terms) errors.terms = 'Необходимо принять условия использования';

      var count = applyErrors(form, errors);
      if (count) {
        showAlert(form, 'error', 'Не удалось создать аккаунт',
          'Исправьте ' + count + ' ' + plural(count, 'ошибку', 'ошибки', 'ошибок') + ' в выделенных полях.');
        return;
      }
      var users = getUsers();
      users.push({ name: name, email: email, password: pass });
      writeJSON(KEY_USERS, users);
      writeJSON(KEY_SESSION, email);
      window.location.href = 'success.html';
    });
  }

  // ----- вход -----
  function initLogin(form) {
    clearOnInput(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.elements.email.value.trim().toLowerCase();
      var pass = form.elements.password.value;
      var errors = {};
      var user = null;

      if (!email) errors.email = 'Введите email';
      else if (!EMAIL_RE.test(email)) errors.email = 'Некорректный email. Пример: name@mail.ru';
      if (!pass) errors.password = 'Введите пароль';

      if (!Object.keys(errors).length) {
        user = getUsers().filter(function (u) { return u.email === email; })[0];
        if (!user) {
          errors.email = 'Аккаунт с таким email не найден. Проверьте адрес или создайте аккаунт';
        } else if (user.password !== pass) {
          errors.password = 'Неверный пароль. Попробуйте ещё раз';
        }
      }

      var count = applyErrors(form, errors);
      if (count) {
        showAlert(form, 'error', 'Не удалось войти', 'Проверьте введённые данные и повторите попытку.');
        return;
      }
      writeJSON(KEY_SESSION, user.email);
      flash('Вы вошли как ' + user.name, 'success');
      window.location.href = 'index.html';
    });
  }

  // ---------- каталог: фильтр и сортировка ----------
  function initCatalog() {
    var dropdowns = document.querySelectorAll('.dropdown');
    var grid = document.querySelector('[data-catalog]');
    var counter = document.querySelector('[data-count]');

    function closeAll(except) {
      dropdowns.forEach(function (dd) {
        if (dd !== except) {
          dd.classList.remove('is-open');
          dd.querySelector('.dropdown__btn').setAttribute('aria-expanded', 'false');
        }
      });
    }
    function selected(name) {
      return document.querySelector('[data-dropdown="' + name + '"] .is-selected').dataset.value;
    }
    function applyCatalog() {
      if (!grid) return;
      var filter = selected('filter');
      var sort = selected('sort');
      var cards = Array.prototype.slice.call(grid.children);
      cards.sort(function (a, b) {
        if (sort === 'name') return a.dataset.title.localeCompare(b.dataset.title, 'ru');
        if (sort === 'popular') return Number(b.dataset.pop) - Number(a.dataset.pop);
        return Number(b.dataset.date) - Number(a.dataset.date);
      });
      var shown = 0;
      cards.forEach(function (card) {
        var visible = filter === 'all' || card.dataset.category === filter;
        card.hidden = !visible;
        if (visible) shown++;
        grid.appendChild(card);
      });
      if (counter) counter.textContent = 'Найдено: ' + shown;
    }

    dropdowns.forEach(function (dd) {
      var btn = dd.querySelector('.dropdown__btn');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !dd.classList.contains('is-open');
        closeAll(dd);
        dd.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      });
      dd.querySelectorAll('.dropdown__item').forEach(function (item) {
        item.addEventListener('click', function () {
          dd.querySelectorAll('.dropdown__item').forEach(function (i) { i.classList.remove('is-selected'); });
          item.classList.add('is-selected');
          dd.querySelector('.dropdown__value').textContent = item.textContent.trim();
          closeAll();
          applyCatalog();
        });
      });
    });
    document.addEventListener('click', function () { closeAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
    applyCatalog();
  }

  // ---------- кнопки действий ----------
  function initActions() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action], [data-theme-set]');
      if (!el) return;

      if (el.dataset.themeSet) { setTheme(el.dataset.themeSet, true); return; }

      switch (el.dataset.action) {
        case 'cycle-theme':
          cycleTheme();
          break;

        case 'toggle-password': {
          var input = el.parentElement.querySelector('input');
          var show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          el.textContent = show ? 'Скрыть' : 'Показать';
          break;
        }

        case 'start-review':
          toast('Повтор начат: 24 карточки в очереди', 'info');
          break;

        case 'join': {
          // ошибка пользователя: участвовать может только вошедший
          if (!currentUser()) {
            toast('Чтобы участвовать в соревновании, войдите в аккаунт', 'error');
            return;
          }
          var card = el.closest('.deck-card');
          var title = card ? card.querySelector('.deck-card__topic').textContent : '';
          el.textContent = 'Вы участвуете ✓';
          el.disabled = true;
          toast('Вы записаны на соревнование «' + title + '»', 'success');
          break;
        }

        case 'results':
          toast('Таблица результатов появится позже', 'info');
          break;

        case 'logout':
          try { localStorage.removeItem(KEY_SESSION); } catch (err) {}
          renderSession();
          toast('Вы вышли из аккаунта', 'info');
          break;
      }
    });
  }

  // доступно для других скриптов (chat.js)
  window.MemoCards = { toast: toast, flash: flash };

  // ---------- запуск ----------
  initActions();
  markThemeButtons();
  renderSession();
  showFlash();

  var registerForm = document.querySelector('[data-form="register"]');
  var loginForm = document.querySelector('[data-form="login"]');
  if (registerForm) initRegister(registerForm);
  if (loginForm) initLogin(loginForm);
  if (document.querySelector('.toolbar')) initCatalog();
})();
