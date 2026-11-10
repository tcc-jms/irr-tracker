/**
 * src/components/tracker-bind.js
 * Tracker 表格事件綁定
 */

(function(root) {
  'use strict';

  function bindTracker(container, handlers) {
    if (!container) return;
    handlers = handlers || {};
    Array.prototype.forEach.call(container.querySelectorAll('.t-inp'), function(input) {
      input.addEventListener('focus', function() {
        if (handlers.onFocus) handlers.onFocus(input);
      });
      input.addEventListener('input', function() {
        if (handlers.onInput) handlers.onInput(input);
      });
      input.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        var inputs = Array.prototype.slice.call(container.querySelectorAll('.t-inp'));
        var index = inputs.indexOf(input);
        if (inputs[index + 1]) inputs[index + 1].focus();
      });
    });
    var saveButton = container.querySelector('#save-yr');
    if (saveButton) saveButton.addEventListener('click', function() {
      if (handlers.onSave) handlers.onSave();
    });
    var cancelButton = container.querySelector('#cancel-edit');
    if (cancelButton) cancelButton.addEventListener('click', function() {
      if (handlers.onCancel) handlers.onCancel();
    });
  }

  window.AppTrackerBind = {
    bindTracker: bindTracker
  };

})(typeof window !== 'undefined' ? window : globalThis);
