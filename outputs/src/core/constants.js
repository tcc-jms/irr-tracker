/**
 * src/core/constants.js
 * 系統常數定義
 */

(function(root) {
  'use strict';

  window.AppConstants = {
    // 應用版本
    VERSION: '0.2.1',
    SCHEMA_VERSION: 2,

    // 儲存相關
    STORAGE_KEY: 'irr-tracker-v4',
    STORAGE_WARN_KB: 2500,
    STORAGE_MAX_KB: 4800,

    // 狀態常數
    PROJECT_MODES: ['formula', 'report'],
    DEFAULT_MODE: 'formula',

    // 報告狀態
    REPORT_STATUS: {
      PENDING: 'pending',
      SUBMITTED: 'submitted',
      APPROVED: 'approved'
    },

    // 通知類型
    NOTICE_TYPE: {
      ANNUAL_REPORT: 'annual-report',
      APPROVAL: 'approval',
      INFO: 'info'
    },

    // 審計操作類型
    AUDIT_ACTION: {
      CREATE: 'create',
      UPDATE: 'update',
      DELETE: 'delete',
      UPLOAD: 'upload',
      EXPORT: 'export',
      IMPORT: 'import',
      SUBMIT_REPORT: 'submit_report'
    },

    // 頁面名稱
    PAGES: {
      OVERVIEW: 'overview',
      PROJECT: 'project',
      UPLOAD: 'upload',
      NOTICES: 'notices',
      AUDIT: 'audit',
      BACKUP: 'backup'
    },

    // 日期相關
    DEFAULT_DISCOUNT_RATE: 0.1
  };

})(typeof window !== 'undefined' ? window : globalThis);
