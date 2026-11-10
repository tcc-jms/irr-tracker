/**
 * src/core/access.js
 * Front-end access gate for administrative pages
 */

(function(root) {
  'use strict';

  var CODE_KEY = 'irr-tracker-admin-code';
  var SESSION_KEY = 'irr-tracker-admin-session';
  var protectedPages = ['audit', 'backup'];
  var changeHandler = null;

  function getStorageValue(storage, key) {
    try {
      return storage.getItem(key);
    } catch (error) {
      console.error('Unable to read administrative access settings:', error);
      return null;
    }
  }

  function isConfigured() {
    return !!getStorageValue(window.localStorage, CODE_KEY);
  }

  function isAuthorized() {
    return getStorageValue(window.sessionStorage, SESSION_KEY) === 'granted';
  }

  function notifyChange() {
    if (changeHandler) changeHandler(isAuthorized());
  }

  function closeDialog() {
    var overlay = document.getElementById('modal');
    if (overlay) overlay.classList.remove('show');
  }

  function open(onGranted) {
    var overlay = document.getElementById('modal');
    var title = document.getElementById('modal-title');
    var body = document.getElementById('modal-body');
    var ok = document.getElementById('modal-ok');
    var cancel = document.getElementById('modal-cancel');
    if (!overlay || !title || !body || !ok || !cancel) return;

    var setup = !isConfigured();
    title.textContent = setup ? '設定管理者通行碼' : '管理者驗證';
    body.innerHTML = (setup
      ? '<p>首次使用請由管理者設定通行碼。此通行碼僅用於隱藏管理頁面的前端門檻。</p>' +
        '<label class="f"><span>設定通行碼（至少 6 個字元）</span><input id="admin-code" type="password" autocomplete="new-password" minlength="6" required></label>' +
        '<label class="f"><span>再次輸入通行碼</span><input id="admin-code-confirm" type="password" autocomplete="new-password" minlength="6" required></label>'
      : '<label class="f"><span>管理者通行碼</span><input id="admin-code" type="password" autocomplete="current-password" required></label>') +
      '<div id="admin-access-error" class="err" role="alert" hidden></div>';
    ok.textContent = setup ? '設定並登入' : '登入';
    ok.className = 'btn';
    cancel.textContent = '取消';
    overlay.classList.add('show');

    var codeInput = document.getElementById('admin-code');
    var errorEl = document.getElementById('admin-access-error');

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      codeInput.focus();
    }

    function submit() {
      var code = codeInput.value;
      if (setup && code.length < 6) {
        showError('通行碼至少需要 6 個字元。');
        return;
      }
      if (setup && code !== document.getElementById('admin-code-confirm').value) {
        showError('兩次輸入的通行碼不一致。');
        return;
      }
      try {
        if (setup) window.localStorage.setItem(CODE_KEY, code);
        else if (getStorageValue(window.localStorage, CODE_KEY) !== code) {
          showError('通行碼錯誤。');
          return;
        }
        window.sessionStorage.setItem(SESSION_KEY, 'granted');
      } catch (error) {
        console.error('Unable to save administrative access settings:', error);
        showError('瀏覽器無法保存權限設定，請檢查儲存空間設定後重試。');
        return;
      }
      closeDialog();
      notifyChange();
      if (onGranted) onGranted();
    }

    ok.onclick = submit;
    cancel.onclick = closeDialog;
    body.querySelector('input').focus();
    body.querySelectorAll('input').forEach(function(input) {
      input.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      });
    });
  }

  function logout() {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error('Unable to clear administrative session:', error);
    }
    notifyChange();
  }

  window.AppAccess = {
    isAuthorized: isAuthorized,
    canAccess: function(page) {
      return protectedPages.indexOf(page) === -1 || isAuthorized();
    },
    isProtectedPage: function(page) {
      return protectedPages.indexOf(page) !== -1;
    },
    open: open,
    logout: logout,
    setChangeHandler: function(handler) {
      changeHandler = handler;
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
