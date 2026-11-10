/**
 * src/main.js
 * 應用程式主入口
 */
import { supabase } from './core/supabase.js';
window.supabase = supabase;
(function(root) {
  'use strict';

  var Constants = window.AppConstants || {};
  var State = window.AppState || {};
  var Storage = window.StorageAPI || {};
  var Router = window.AppRouter || {};
  var Audit = window.AuditLog || {};
  var Engine = window.IRREngine || {};
  var Compute = window.AppCompute || {};
  var Notifications = window.AppNotifications || {};
  var Access = window.AppAccess || {};
  var liveEdit = null;
  var draft = null;

  function save() {
    var db = State.state && State.state.db;
    return db && Storage.save ? Storage.save(db, function(message) {
      if (window.AppToast) window.AppToast.show(message);
    }) : false;
  }

  function audit(action, options) {
    var record = Audit.log ? Audit.log(action, options) : null;
    save();
    return record;
  }

  var appRuntime = window.AppRuntime || {};
  window.AppRuntime = appRuntime;
  Object.defineProperties(appRuntime, {
    db: { configurable: true, get: function() { return State.state && State.state.db; } },
    liveEdit: { configurable: true, get: function() { return liveEdit; }, set: function(value) { liveEdit = value; } },
    draft: { configurable: true, get: function() { return draft; }, set: function(value) { draft = value; } }
  });
  Object.assign(appRuntime, {
    save: save,
    audit: audit,
    toast: function(message, duration) {
      if (window.AppToast) window.AppToast.show(message, duration);
    },
    confirm: function(title, content, onOk, options) {
      if (window.AppModal) window.AppModal.show(title, content, onOk, options);
    }
  });

  function initializeSeedData(db) {
    var seed = window.AppSeed;
    if (!seed || db.projects.length || db.seeded || !Engine.makeCalc || !Engine.snapshot) return;
    try {
      var calc = Engine.makeCalc(seed.wb, {});
      var baseline = Engine.snapshot(calc, seed.model);
      var reportRows = Compute.getReportRows ? Compute.getReportRows(seed.model, baseline) : [];
      db.projects.push({
        id: 'P' + String(db.seq++).padStart(3, '0'),
        schemaVersion: Constants.SCHEMA_VERSION,
        name: seed.meta.name,
        code: seed.meta.code || '',
        plant: seed.meta.plant || '',
        owner: seed.meta.owner || '',
        fileName: seed.fileName,
        uploadedAt: db.today,
        createdAt: db.today,
        updatedAt: db.today,
        startDate: (Number(db.today.slice(0, 4)) + 1) + '-01-01',
        graceDays: 30,
        contacts: { plant: '（未設定）', hq: '（未設定）' },
        model: seed.model,
        wb: Engine.extractNeeded ? Engine.extractNeeded(seed.wb, seed.model.sheet) : seed.wb,
        baseline: baseline,
        reportRows: reportRows,
        mode: 'formula',
        reports: {}
      });
      db.seeded = true;
      save();
    } catch (e) {
      console.error('SEED initialization failed:', e);
    }
  }

  function initialize() {
    console.log('Initializing IRR Tracker v' + Constants.VERSION);
    var db = Storage.initialize ? Storage.initialize() : null;
    if (!db) {
      db = {
        schemaVersion: Constants.SCHEMA_VERSION,
        version: 1,
        projects: [],
        notices: [],
        auditLogs: [],
        today: new Date().toISOString().slice(0, 10),
        seq: 1
      };
    }
    db.projects = db.projects || [];
    db.notices = db.notices || [];
    db.auditLogs = db.auditLogs || [];
    db.seq = db.seq || 1;
    if (State.setDb) State.setDb(db);
    initializeSeedData(db);
    bindNavigation();
    bindDatePicker();
    if (Notifications.runScheduler && Notifications.runScheduler(db, db.today)) save();
    audit('app_start', {
      resourceType: 'system',
      resourceId: 'main',
      details: { version: Constants.VERSION, schemaVersion: Constants.SCHEMA_VERSION },
      summary: '應用程式啟動'
    });
    if (Router.route) Router.route();
    console.log('Application initialized');
  }

  function bindNavigation() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var pages = Constants.PAGES || {};
    nav.innerHTML = Object.keys(pages).map(function(key) {
      var page = pages[key];
      if (page === 'project') return '';
      if (Access.isProtectedPage && Access.isProtectedPage(page) && !Access.isAuthorized()) return '';
      return '<a href="#' + page + '" data-page="' + page + '">' + getPageLabel(page) + '</a>';
    }).join('') + '<button class="admin-access" id="admin-access" type="button">' +
      (Access.isAuthorized() ? '管理者登出' : '管理者登入') + '</button>';
    Access.setChangeHandler(function() {
      bindNavigation();
      if (!Access.isAuthorized() && Access.isProtectedPage(Router.getCurrentPage())) Router.navigate('/overview');
    });
    document.getElementById('admin-access').addEventListener('click', function() {
      if (Access.isAuthorized()) Access.logout();
      else Access.open();
    });
  }

  function getPageLabel(page) {
    var labels = {
      overview: '追蹤總覽', project: '專案', upload: '上傳提報 Excel',
      notices: '通知紀錄', audit: '操作紀錄', backup: '備份 / 恢復'
    };
    return labels[page] || page;
  }

  function bindDatePicker() {
    var todayInput = document.getElementById('today');
    var db = State.state && State.state.db;
    if (!todayInput || !db) return;
    todayInput.value = db.today;
    todayInput.addEventListener('change', function() {
      if (!this.value || !State.state || !State.state.db) return;
      var previous = State.state.db.today;
      State.state.db.today = this.value;
      audit('date_changed', {
        resourceType: 'settings',
        resourceId: 'today',
        details: { before: previous, after: this.value },
        summary: '變更系統日期'
      });
      if (Notifications.runScheduler) Notifications.runScheduler(State.state.db, this.value);
      save();
      if (Router.route) Router.route();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})(typeof window !== 'undefined' ? window : globalThis);
