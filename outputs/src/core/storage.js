/**
 * src/core/storage.js
 * localStorage 操作封裝
 * 負責資料持久化、遷移、匯出/匯入
 */

(function(root) {
  'use strict';

  var C = window.AppConstants || {};
  var State = window.AppState || {};

  /**
   * 資料遷移函數
   * 處理舊版本資料結構升級到新版本
   * @param {Object} raw - 原始資料
   * @returns {Object} 遷移後的資料
   */
  function migrateDb(raw) {
    if (!raw) return null;

    // 版本 1 → 版本 2 遷移
    if (!raw.schemaVersion || raw.schemaVersion < 2) {
      raw.schemaVersion = 2;
      raw.auditLogs = raw.auditLogs || [];

      // 遍歷每個專案進行遷移
      for (var i = 0; i < (raw.projects || []).length; i++) {
        var p = raw.projects[i];
        p.schemaVersion = 2;

        // 補充缺失的欄位
        p.createdAt = p.uploadedAt || p.createdAt || raw.today || '';
        p.updatedAt = p.updatedAt || p.createdAt;
        if (!p.contacts) p.contacts = { plant: '', hq: '' };
        if (!p.reports) p.reports = {};
        if (!p.mode) p.mode = 'formula';
        if (!p.reportRows) p.reportRows = [];
      }
    }

    return raw;
  }

  /**
   * 從 localStorage 載入資料
   * @returns {Object|null} 載入的資料或 null
   */
  function load() {
    try {
      var s = localStorage.getItem(C.STORAGE_KEY);
      if (s) {
        return migrateDb(JSON.parse(s));
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    return null;
  }

  /**
   * 保存資料到 localStorage
   * @param {Object} db - 要保存的資料庫物件
   * @param {Function} notifyFn - 通知函數（可選）
   * @returns {boolean} 是否保存成功
   */
  function save(db, notifyFn) {
    if (!db) {
      console.error('Cannot save: db is null or undefined');
      return false;
    }

    try {
      var data = JSON.stringify(db);
      var kb = Math.round(data.length * 2 / 1024);

      // 檢查儲存空間上限
      if (kb > C.STORAGE_MAX_KB) {
        if (notifyFn) {
          notifyFn('⚠ 儲存空間接近上限（' + kb + ' KB），請先匯出備份！');
        }
        return false;
      }

      // 保存到 localStorage
      localStorage.setItem(C.STORAGE_KEY, data);

      // 如果超過警告閾值，發出警告
      if (kb > C.STORAGE_WARN_KB) {
        if (notifyFn) {
          notifyFn('注意：儲存空間已用 ' + kb + ' KB，建議匯出備份。');
        }
      }

      return true;
    } catch (e) {
      console.error('Failed to save:', e);
      if (notifyFn) {
        if (e.name === 'QuotaExceededError') {
          notifyFn('❌ 儲存空間已滿！請立即匯出備份並清理資料。');
        } else {
          notifyFn('保存失敗：' + e.message);
        }
      }
      return false;
    }
  }

  /**
   * 計算 localStorage 使用的空間大小
   * @returns {number} 使用的空間（KB）
   */
  function storageUsageKb() {
    try {
      var s = localStorage.getItem(C.STORAGE_KEY) || '';
      return Math.round(s.length * 2 / 1024);
    } catch (e) {
      console.error('Failed to calculate storage usage:', e);
      return 0;
    }
  }

  /**
   * 匯出資料為 JSON 字串
   * 用於備份或下載到本地
   * @param {Object} db - 要匯出的資料庫物件
   * @returns {string} JSON 字串
   */
  function exportData(db) {
    if (!db) return '';
    try {
      return JSON.stringify(db, null, 2);
    } catch (e) {
      console.error('Failed to export data:', e);
      return '';
    }
  }

  /**
   * 匯入 JSON 資料
   * @param {string} jsonStr - JSON 字串
   * @returns {Object|null} 解析後的資料或 null
   */
  function importData(jsonStr) {
    if (!jsonStr) return null;
    try {
      var data = JSON.parse(jsonStr);
      // 驗證基本結構
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }
      // 進行遷移檢查
      return migrateDb(data);
    } catch (e) {
      console.error('Failed to import data:', e);
      return null;
    }
  }

  /**
   * 清除所有資料
   * 用於重置應用或卸載
   */
  function clear() {
    try {
      localStorage.removeItem(C.STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
  }

  /**
   * 初始化儲存系統
   * 載入已保存的資料並同步到狀態
   * @returns {Object} 載入的資料庫物件
   */
  function initialize() {
    var loadedDb = load();
    var db = loadedDb || {
      schemaVersion: C.SCHEMA_VERSION,
      version: 1,
      projects: [],
      notices: [],
      auditLogs: [],
      today: new Date().toISOString().slice(0, 10),
      seq: 1
    };

    // 同步到全局狀態
    if (State.setDb) {
      State.setDb(db);
    }

    return db;
  }

  window.StorageAPI = {
    load: load,
    save: save,
    migrate: migrateDb,
    export: exportData,
    import: importData,
    clear: clear,
    storageUsageKb: storageUsageKb,
    initialize: initialize
  };

})(typeof window !== 'undefined' ? window : globalThis);
