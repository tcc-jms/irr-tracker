/**
 * src/core/state.js
 * 全局狀態管理
 * 實現簡單的觀察者模式
 */

(function(root) {
  'use strict';

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  window.AppState = {
    state: {
      // 主要資料庫
      db: {
        schemaVersion: 2,
        version: 1,
        projects: [],
        notices: [],
        auditLogs: [],
        today: today(),
        seq: 1
      },

      // 當前編輯中的專案
      liveEdit: null,

      // 草稿編輯（用於未保存的修改）
      draft: null,

      // 概覽頁篩選狀態
      overviewFilter: {
        q: '',           // 搜尋關鍵字
        plant: '',       // 廠區篩選
        status: '',      // 狀態篩選
        sort: 'default'  // 排序方式
      },

      // 搜尋結果快取
      searchResults: [],

      // 當前路由
      currentPage: 'overview'
    },

    // 狀態訂閱者
    listeners: [],

    /**
     * 取得當前狀態
     * @returns {Object} 當前狀態的完整副本
     */
    get: function() {
      return this.state;
    },

    /**
     * 設定狀態（部分更新）
     * 會觸發所有訂閱者
     * @param {Object} patch - 要合併的狀態片段
     */
    set: function(patch) {
      if (!patch || typeof patch !== 'object') {
        return;
      }

      // 深度合併（僅針對已知的嵌套對象）
      if (patch.db) {
        Object.assign(this.state.db, patch.db);
      }
      if (patch.overviewFilter) {
        Object.assign(this.state.overviewFilter, patch.overviewFilter);
      }

      // 淺層合併其他屬性
      for (var key in patch) {
        if (patch.hasOwnProperty(key) && key !== 'db' && key !== 'overviewFilter') {
          this.state[key] = patch[key];
        }
      }

      // 通知所有訂閱者
      for (var i = 0; i < this.listeners.length; i++) {
        try {
          this.listeners[i](this.state);
        } catch (e) {
          console.error('Listener error:', e);
        }
      }
    },

    /**
     * 訂閱狀態變更
     * @param {Function} fn - 回調函數，會收到新的狀態
     * @returns {Function} 取消訂閱的函數
     */
    subscribe: function(fn) {
      if (typeof fn !== 'function') {
        return function() {};
      }

      this.listeners.push(fn);

      // 返回取消訂閱函數
      var self = this;
      return function() {
        var idx = self.listeners.indexOf(fn);
        if (idx > -1) {
          self.listeners.splice(idx, 1);
        }
      };
    },

    /**
     * 設定 db（整體替換）
     * @param {Object} newDb - 新的 db 物件
     */
    setDb: function(newDb) {
      this.set({ db: newDb });
    },

    /**
     * 更新過濾條件
     * @param {Object} filters - 過濾條件片段
     */
    updateFilter: function(filters) {
      this.set({
        overviewFilter: filters
      });
    },

    /**
     * 設定當前編輯的專案
     * @param {Object} project - 專案物件或 null
     */
    setLiveEdit: function(project) {
      this.set({ liveEdit: project });
    },

    /**
     * 設定草稿
     * @param {Object} draft - 草稿物件或 null
     */
    setDraft: function(draft) {
      this.set({ draft: draft });
    },

    /**
     * 導航到頁面
     * @param {string} page - 頁面名稱
     */
    navigateTo: function(page) {
      this.set({ currentPage: page });
    },

    /**
     * 清空狀態（重置為初始狀態）
     */
    reset: function() {
      this.state = {
        db: {
          schemaVersion: 2,
          version: 1,
          projects: [],
          notices: [],
          auditLogs: [],
          today: today(),
          seq: 1
        },
        liveEdit: null,
        draft: null,
        overviewFilter: {
          q: '',
          plant: '',
          status: '',
          sort: 'default'
        },
        searchResults: [],
        currentPage: 'overview'
      };
      this.listeners = [];
    }
  };

  window.AppRuntime = window.AppRuntime || {};

})(typeof window !== 'undefined' ? window : globalThis);
