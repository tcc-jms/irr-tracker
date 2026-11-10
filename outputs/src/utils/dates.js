/**
 * src/utils/dates.js
 * 日期操作工具
 */

(function(root) {
  'use strict';

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateToYmd(d) {
    if (typeof d === 'string') return d;
    return new Date(d).toISOString().slice(0, 10);
  }

  function parseDate(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function daysBetween(d1, d2) {
    var a = parseDate(d1);
    var b = parseDate(d2);
    if (!a || !b) return 0;
    return Math.floor((b - a) / 86400000);
  }

  function addDays(d, n) {
    var date = parseDate(d);
    if (!date) return null;
    date.setDate(date.getDate() + n);
    return dateToYmd(date);
  }

  function quarterOf(d) {
    var date = parseDate(d);
    if (!date) return null;
    var m = date.getMonth();
    return Math.floor(m / 3) + 1;
  }

  function weekNumber(d) {
    var date = parseDate(d);
    if (!date) return null;
    var first = new Date(date.getFullYear(), 0, 1);
    var dm = (date - first) / 86400000;
    return Math.floor(dm / 7) + 1;
  }

  function addDays(d, n) {
    var date = parseDate(d);
    if (!date) return null;
    date.setDate(date.getDate() + n);
    return dateToYmd(date);
  }

  function addYears(d, n) {
    var date = parseDate(d);
    if (!date) return null;
    date.setFullYear(date.getFullYear() + n);
    return dateToYmd(date);
  }

  window.AppDates = {
    today: today,
    dateToYmd: dateToYmd,
    parseDate: parseDate,
    daysBetween: daysBetween,
    addDays: addDays,
    quarterOf: quarterOf,
    weekNumber: weekNumber,
    addDays: addDays,
    addYears: addYears
  };

})(typeof window !== 'undefined' ? window : globalThis);
