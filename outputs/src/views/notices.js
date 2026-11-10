/**
 * src/views/notices.js
 * 通知頁面
 */

(function(root) {
  'use strict';

  var State = window.AppState || {};
  var Runtime = window.AppRuntime || {};
  var Notifications = window.AppNotifications || {};
  var Esc = window.AppEsc || {};

  function render() {
    var appEl = document.getElementById('app');
    if (!appEl) return;
    var db = State.state && State.state.db || {};
    var list = db.notices || [];
    var labels = { remind: ['提醒廠端', 'due'], overdue: ['逾期通知', 'late'], submitted: ['回覆總部', 'ok'] };
    var body = list.length ? list.map(function(notice) {
      var label = labels[notice.kind] || ['通知', 'idle'];
      return '<details class="notice"><summary><span class="tag ' + label[1] + '">' + label[0] + '</span><b>' +
        Esc.escape(notice.subject || '') + '</b><span class="small muted" style="margin-left:auto">' + Esc.escape(notice.at || '') + ' · ' + Esc.escape(notice.to || '') +
        '</span></summary><pre>' + Esc.escape(notice.body || '') + '</pre></details>';
    }).join('') : '<div class="empty">尚無通知紀錄。調整系統日期或執行提醒排程以檢查年度回報。</div>';

    appEl.innerHTML = '<h2>通知紀錄</h2><p class="lead">共 ' + list.length + ' 則通知；此原型不會實際寄送 Email。</p>' +
      '<div class="panel" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>目前系統日期：<b>' + Esc.escape(db.today || '') + '</b></span>' +
      '<div><button class="btn ghost sm" id="run-notices" type="button">執行提醒排程</button> <button class="btn danger sm" id="clear-notices" type="button">清除全部</button></div></div>' + body;

    document.getElementById('run-notices').addEventListener('click', function() {
      var count = Notifications.runScheduler(db, db.today);
      Runtime.save();
      Runtime.toast(count ? '產生 ' + count + ' 則新通知' : '沒有新的通知');
      render();
    });
    document.getElementById('clear-notices').addEventListener('click', function() {
      Runtime.confirm('清除通知', '<p>確定要清除所有通知紀錄？</p>', function() {
        db.notices = [];
        Runtime.audit('delete', { resourceType: 'notice', resourceId: 'all', details: {}, summary: '清除通知紀錄' });
        render();
      }, { danger: true, okLabel: '清除' });
    });
  }

  window.Views = window.Views || {};
  window.Views.notices = { render: render };

})(typeof window !== 'undefined' ? window : globalThis);
