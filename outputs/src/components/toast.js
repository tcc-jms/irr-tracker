/**
 * src/components/toast.js
 * Toast 提示組件
 */

(function(root) {
  'use strict';

  var toastId = 'app-toast';
  var timeout;

  function show(msg, duration) {
    if (duration === undefined) duration = 3000;
    
    clearTimeout(timeout);
    var el = document.getElementById(toastId);
    if (!el) {
      el = document.createElement('div');
      el.id = toastId;
      el.className = 'toast';
      document.body.appendChild(el);
    }
    
    el.textContent = msg;
    el.style.display = 'block';
    
    timeout = setTimeout(function() {
      el.style.display = 'none';
    }, duration);
  }

  function hide() {
    var el = document.getElementById(toastId);
    if (el) el.style.display = 'none';
  }

  window.AppToast = {
    show: show,
    hide: hide
  };

})(typeof window !== 'undefined' ? window : globalThis);
