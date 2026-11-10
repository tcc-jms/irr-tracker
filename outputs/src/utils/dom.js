/**
 * src/utils/dom.js
 * DOM 操作工具函數
 */

(function(root) {
  'use strict';

  function q(sel) {
    return document.querySelector(sel);
  }

  function qa(sel) {
    return document.querySelectorAll(sel);
  }

  function on(el, evt, fn) {
    if (!el) return;
    el.addEventListener(evt, fn);
  }

  function off(el, evt, fn) {
    if (!el) return;
    el.removeEventListener(evt, fn);
  }

  function html(el, content) {
    if (content === undefined) return el ? el.innerHTML : '';
    if (el) el.innerHTML = content;
  }

  function text(el, content) {
    if (content === undefined) return el ? el.textContent : '';
    if (el) el.textContent = content;
  }

  function cls(el, cn, force) {
    if (!el) return;
    if (force === undefined) {
      el.classList.toggle(cn);
    } else if (force) {
      el.classList.add(cn);
    } else {
      el.classList.remove(cn);
    }
  }

  function attr(el, name, val) {
    if (!el) return '';
    if (val === undefined) return el.getAttribute(name) || '';
    el.setAttribute(name, val);
  }

  window.AppDOM = {
    q: q,
    qa: qa,
    on: on,
    off: off,
    html: html,
    text: text,
    cls: cls,
    attr: attr
  };

})(typeof window !== 'undefined' ? window : globalThis);
