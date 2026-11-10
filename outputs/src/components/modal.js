/**
 * src/components/modal.js
 * 模態對話框組件
 */

(function(root) {
  'use strict';

  function show(title, content, onOk, options) {
    var overlay = document.getElementById('modal');
    if (!overlay) return;
    if (typeof options === 'function') options = { onCancel: options };
    options = options || {};
    
    var titleEl = document.getElementById('modal-title');
    var bodyEl = document.getElementById('modal-body');
    var okBtn = document.getElementById('modal-ok');
    var cancelBtn = document.getElementById('modal-cancel');
    
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content || '';
    if (!okBtn || !cancelBtn) return;
    okBtn.textContent = options.okLabel || '確定';
    okBtn.className = 'btn' + (options.danger ? ' danger' : '');
    cancelBtn.textContent = options.cancelLabel || '取消';
    
    overlay.classList.add('show');
    
    okBtn.onclick = function() {
      overlay.classList.remove('show');
      if (onOk) onOk();
    };
    
    cancelBtn.onclick = function() {
      overlay.classList.remove('show');
      if (options.onCancel) options.onCancel();
    };
  }

  function hide() {
    var overlay = document.getElementById('modal');
    if (overlay) overlay.classList.remove('show');
  }

  window.AppModal = {
    show: show,
    hide: hide
  };

})(typeof window !== 'undefined' ? window : globalThis);
