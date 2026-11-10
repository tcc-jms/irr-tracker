/**
 * src/utils/esc.js
 * 轉義和反轉義工具函數
 */

(function(root) {
  'use strict';

  function unesc(s) {
    return s.replace(/&(lt|gt|amp|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, function(m, e) {
      if (e === 'lt') return '<';
      if (e === 'gt') return '>';
      if (e === 'amp') return '&';
      if (e === 'quot') return '"';
      if (e === 'apos') return "'";
      if (e[1] === 'x') return String.fromCodePoint(parseInt(e.slice(2), 16));
      return String.fromCodePoint(parseInt(e.slice(1), 10));
    });
  }

  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function attr(s, name) {
    var m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(s);
    return m ? unesc(m[1]) : null;
  }

  window.AppEsc = {
    unesc: unesc,
    escape: escape,
    attr: attr
  };

})(typeof window !== 'undefined' ? window : globalThis);
