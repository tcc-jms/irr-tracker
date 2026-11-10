/**
 * src/views/index.js
 * Views 導出入口
 */

(function(root) {
  'use strict';

  window.Views = {
    overview: window.Views && window.Views.overview ? window.Views.overview : {},
    project: window.Views && window.Views.project ? window.Views.project : {},
    upload: window.Views && window.Views.upload ? window.Views.upload : {},
    notices: window.Views && window.Views.notices ? window.Views.notices : {},
    audit: window.Views && window.Views.audit ? window.Views.audit : {},
    backup: window.Views && window.Views.backup ? window.Views.backup : {}
  };

})(typeof window !== 'undefined' ? window : globalThis);
