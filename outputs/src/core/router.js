/**
 * src/core/router.js
 * 路由管理系統
 */

(function(root) {
  'use strict';

  var State = window.AppState || {};
  var Views = window.Views || {};
  var Access = window.AppAccess || {};

  var routes = {};
  var currentParams = {};

  function register(path, viewName) {
    routes[path] = viewName;
  }

  function navigate(path) {
    var normalized = String(path || '/').replace(/^#/, '');
    if (normalized.charAt(0) !== '/') normalized = '/' + normalized;
    var parts = normalized.split('/').filter(Boolean);
    var page = parts[0] || 'overview';
    if (!routes['/' + page] || !Views[routes['/' + page]]) return;
    var hash = page === 'overview' ? '#overview' : '#' + page + (parts[1] ? '/' + encodeURIComponent(parts[1]) : '');
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  }

  function route() {
    var parts = window.location.hash.replace(/^#/, '').split('/');
    var page = parts[0] || 'overview';
    var viewName = routes['/' + page];
    if (!viewName || !Views[viewName]) {
      page = 'overview';
      viewName = 'overview';
      window.location.hash = '#overview';
    }
    if (Access.canAccess && !Access.canAccess(page)) {
      page = 'overview';
      viewName = routes['/overview'];
      window.location.hash = '#overview';
    }
    currentParams = { id: parts[1] ? decodeURIComponent(parts[1]) : null };
    if (State.navigateTo) State.navigateTo(page);
    if (Views[viewName].render) Views[viewName].render(currentParams.id);
    var links = document.querySelectorAll('#nav a[data-page]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('on', links[i].getAttribute('data-page') === page);
    }
  }

  function getCurrentPage() {
    return State.state ? State.state.currentPage : 'overview';
  }

  // 初始化路由
  register('/', 'overview');
  register('/overview', 'overview');
  register('/project', 'project');
  register('/upload', 'upload');
  register('/notices', 'notices');
  register('/audit', 'audit');
  register('/backup', 'backup');
  window.addEventListener('hashchange', route);

  window.AppRouter = {
    register: register,
    navigate: navigate,
    getCurrentPage: getCurrentPage,
    getParams: function() { return currentParams; },
    route: route,
    routes: routes
  };

})(typeof window !== 'undefined' ? window : globalThis);
