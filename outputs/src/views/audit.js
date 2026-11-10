/**
 * src/views/audit.js
 * 審計日誌頁面
 */

(function(root) {
  'use strict';

  var Audit = window.AuditLog || {};
  var Esc = window.AppEsc || {};

  function render() {
    var appEl = document.getElementById('app');
    if (!appEl) return;
    var logs = Audit.getHistory ? Audit.getHistory(500) : [];
    var rows = logs.map(function(item) {
      var details;
      try { details = JSON.stringify(item.details || {}); } catch (e) { details = '[無法顯示]'; }
      return '<tr><td class="small muted">' + Esc.escape(item.timestamp || '') + '</td><td><b>' + Esc.escape(item.action || '') + '</b></td>' +
        '<td>' + Esc.escape(item.resourceType || '–') + '</td><td>' + Esc.escape(item.resourceId || '–') + '</td>' +
        '<td>' + Esc.escape(item.user || '–') + '</td><td><span class="tag ' + (item.status === 'failure' ? 'late' : 'ok') + '">' + Esc.escape(item.status || 'success') + '</span></td>' +
        '<td>' + Esc.escape(item.summary || details) + '</td></tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="7" class="empty">尚無操作紀錄</td></tr>';

    appEl.innerHTML = '<h2>操作紀錄</h2><p class="lead">共 ' + logs.length + ' 筆，最多顯示最近 500 筆。</p>' +
      '<div class="panel"><button class="btn ghost sm" id="export-audit" type="button">匯出審計紀錄 JSON</button></div>' +
      '<div class="panel" style="padding:0;overflow-x:auto"><table><thead><tr><th>時間</th><th>操作</th><th>資源類型</th><th>資源 ID</th><th>操作人</th><th>狀態</th><th>摘要／詳細資料</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    document.getElementById('export-audit').addEventListener('click', function() {
      var blob = new Blob([Audit.export ? Audit.export(true) : '[]'], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'irr-audit-' + new Date().toISOString().slice(0, 10) + '.json';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  window.Views = window.Views || {};
  window.Views.audit = { render: render };

})(typeof window !== 'undefined' ? window : globalThis);
