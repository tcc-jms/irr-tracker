/**
 * src/core/audit.js
 * 審計日誌系統
 * 記錄所有重要操作以供財務合規和故障排查
 */

(function(root) {
  'use strict';

  var State = window.AppState || {};
  var C = window.AppConstants || {};

  /**
   * 生成審計記錄 ID
   * 簡單的順序 ID，結合時間戳
   * @returns {string} 唯一 ID
   */
  function generateId() {
    return 'audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  /**
   * 獲取當前時間的 ISO 字串
   * @returns {string} ISO 8601 時間戳
   */
  function getCurrentTimestamp() {
    return new Date().toISOString();
  }

  /**
   * 獲取當前用戶標識
   * 目前使用簡單的識別機制，未來可從登入系統獲取
   * @returns {string} 用戶識別
   */
  function getCurrentUser() {
    return 'user_' + (State.state && State.state.currentUser ? State.state.currentUser : 'anonymous');
  }

  /**
   * 記錄一條審計日誌
   * @param {string} action - 操作類型（使用 AppConstants.AUDIT_ACTION）
   * @param {Object} options - 選項物件
   *   - resourceType: 資源類型 ('project', 'report', 'settings' 等)
   *   - resourceId: 資源 ID
   *   - details: 詳細信息 (物件)
   *   - user: 操作人 (可選，預設為當前用戶)
   *   - summary: 操作摘要 (可選)
   * @returns {Object} 新建立的審計記錄
   */
  function log(action, options) {
    if (!State.state || !State.state.db) {
      console.error('Audit: AppState not initialized');
      return null;
    }

    options = options || {};

    var record = {
      id: generateId(),
      timestamp: getCurrentTimestamp(),
      action: action,
      resourceType: options.resourceType || '',
      resourceId: options.resourceId || '',
      user: options.user || getCurrentUser(),
      details: options.details || {},
      summary: options.summary || '',
      status: options.status || 'success'
    };

    // 確保 auditLogs 存在
    if (!Array.isArray(State.state.db.auditLogs)) {
      State.state.db.auditLogs = [];
    }

    // 新增記錄到日誌陣列
    State.state.db.auditLogs.push(record);
    if (State.state.db.auditLogs.length > 500) State.state.db.auditLogs.splice(0, State.state.db.auditLogs.length - 500);

    // 發出狀態變更通知
    State.set({ db: State.state.db });
    console.log('[AUDIT]', action, '|', record.resourceType, record.resourceId);

    return record;
  }

  /**
   * 取得最近的審計記錄
   * @param {number} limit - 取回的記錄數（預設 100）
   * @returns {Array} 審計記錄陣列
   */
  function getHistory(limit) {
    if (limit === undefined) limit = 100;
    limit = Math.floor(Number(limit));
    if (!isFinite(limit) || limit <= 0) return [];

    if (!State.state || !State.state.db || !State.state.db.auditLogs) {
      return [];
    }

    var logs = State.state.db.auditLogs;
    if (logs.length <= limit) {
      return logs.slice().reverse();  // 最新的在前
    }

    return logs.slice(-limit).reverse();
  }

  /**
   * 按操作類型篩選審計記錄
   * @param {string} action - 操作類型
   * @param {number} limit - 記錄數限制
   * @returns {Array} 符合條件的記錄
   */
  function getByAction(action, limit) {
    if (limit === undefined) limit = 50;
    limit = Math.floor(Number(limit));
    if (!isFinite(limit) || limit <= 0) return [];

    if (!State.state || !State.state.db || !State.state.db.auditLogs) {
      return [];
    }

    var logs = State.state.db.auditLogs;
    var result = [];

    for (var i = logs.length - 1; i >= 0 && result.length < limit; i--) {
      if (logs[i].action === action) {
        result.push(logs[i]);
      }
    }

    return result;
  }

  /**
   * 按資源篩選審計記錄
   * @param {string} resourceType - 資源類型
   * @param {string} resourceId - 資源 ID
   * @returns {Array} 符合條件的記錄
   */
  function getByResource(resourceType, resourceId) {
    if (!State.state || !State.state.db || !State.state.db.auditLogs) {
      return [];
    }

    var logs = State.state.db.auditLogs;
    var result = [];

    for (var i = logs.length - 1; i >= 0; i--) {
      var log_item = logs[i];
      if (log_item.resourceType === resourceType && log_item.resourceId === resourceId) {
        result.push(log_item);
      }
    }

    return result;
  }

  /**
   * 清空審計日誌
   * 通常在資料重置時使用
   */
  function clear() {
    if (State.state && State.state.db) {
      State.state.db.auditLogs = [];
      State.set({ db: State.state.db });
      persist();
    }
  }

  /**
   * 匯出審計日誌為 JSON
   * 用於下載備份或外部審查
   * @param {boolean} pretty - 是否格式化（預設 true）
   * @returns {string} JSON 字串
   */
  function exportLogs(pretty) {
    if (pretty === undefined) pretty = true;

    if (!State.state || !State.state.db || !State.state.db.auditLogs) {
      return '[]';
    }

    try {
      return JSON.stringify(
        State.state.db.auditLogs,
        null,
        pretty ? 2 : 0
      );
    } catch (e) {
      console.error('Failed to export audit logs:', e);
      return '[]';
    }
  }

  /**
   * 獲取審計統計信息
   * @returns {Object} 統計資訊
   */
  function getStats() {
    if (!State.state || !State.state.db || !State.state.db.auditLogs) {
      return {
        total: 0,
        byAction: {},
        byUser: {},
        lastRecord: null
      };
    }

    var logs = State.state.db.auditLogs;
    var byAction = {};
    var byUser = {};

    for (var i = 0; i < logs.length; i++) {
      var log_item = logs[i];

      byAction[log_item.action] = (byAction[log_item.action] || 0) + 1;
      byUser[log_item.user] = (byUser[log_item.user] || 0) + 1;
    }

    return {
      total: logs.length,
      byAction: byAction,
      byUser: byUser,
      lastRecord: logs.length > 0 ? logs[logs.length - 1] : null
    };
  }

  /**
   * 記錄一個失敗的操作
   * @param {string} action - 操作類型
   * @param {Object} options - 選項物件
   * @param {string} errorMessage - 錯誤信息
   * @returns {Object} 新建立的審計記錄
   */
  function logError(action, options, errorMessage) {
    options = Object.assign({}, options || {});
    options.details = Object.assign({}, options.details || {}, { error: errorMessage });
    options.status = 'failure';
    return log(action, options);
  }

  window.AuditLog = {
    log: log,
    logError: logError,
    getHistory: getHistory,
    getByAction: getByAction,
    getByResource: getByResource,
    clear: clear,
    export: exportLogs,
    getStats: getStats
  };

})(typeof window !== 'undefined' ? window : globalThis);
