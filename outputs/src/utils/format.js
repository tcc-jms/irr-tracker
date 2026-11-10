/**
 * src/utils/format.js
 * 數字和日期格式化工具
 */

(function(root) {
  'use strict';

  function str(v) {
    if (v == null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return String(v);
  }

  function fmtText(n, fmt) {
    if (typeof n !== 'number') return str(n);
    var isPct = /%/.test(fmt);
    if (isPct) n *= 100;
    var dm = /0\.(0+)/.exec(fmt);
    var d = dm ? dm[1].length : 0;
    var s = Math.abs(n).toFixed(d);
    if (/#,##0|,0/.test(fmt)) {
      var parts = s.split('.');
      s = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts[1] ? '.' + parts[1] : '');
    }
    return (n < 0 ? '-' : '') + s + (isPct ? '%' : '');
  }

  function fmtNum(n, decimals) {
    if (typeof n !== 'number') return n;
    if (decimals === undefined) decimals = 2;
    return n.toFixed(decimals);
  }

  function fmtPercent(n, decimals) {
    if (decimals === undefined) decimals = 1;
    return typeof n === 'number' && isFinite(n) ? (n * 100).toFixed(decimals) + '%' : '–';
  }

  function formatNumber(n, decimals) {
    if (typeof n !== 'number' || !isFinite(n)) return n && n.err ? n.err : '–';
    return n.toLocaleString('zh-TW', {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals || 0
    });
  }

  function percentagePoints(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return (n >= 0 ? '+' : '−') + Math.abs(n * 100).toFixed(2) + ' pp';
  }

  window.AppFormat = {
    str: str,
    fmtText: fmtText,
    fmtNum: fmtNum,
    fmtPercent: fmtPercent,
    formatNumber: formatNumber,
    percentagePoints: percentagePoints
  };

})(typeof window !== 'undefined' ? window : globalThis);
