/**
 * src/views/backup.js
 * 備份和還原頁面
 */

(function(root) {
  'use strict';

  var State = window.AppState || {};
  var Runtime = window.AppRuntime || {};
  var Storage = window.StorageAPI || {};
  var Constants = window.AppConstants || {};
  var Esc = window.AppEsc || {};

  function render() {
    var appEl = document.getElementById('app');
    if (!appEl) return;
    var db = State.state && State.state.db;
    var usedKb = Storage.storageUsageKb ? Storage.storageUsageKb() : 0;
    var maxKb = Constants.STORAGE_MAX_KB || 5000;
    var percent = Math.min(100, Math.round(usedKb / maxKb * 100));
    appEl.innerHTML = '<h2>備份 / 恢復</h2><p class="lead">匯出或匯入完整追蹤資料。匯入會取代目前資料，請先備份。</p>' +
      '<div class="panel"><h3>儲存空間</h3><div>目前使用：<b>' + usedKb + ' KB</b> / 約 ' + maxKb + ' KB</div><div class="storage-bar"><div class="storage-bar-fill" style="width:' + percent + '%"></div></div></div>' +
      '<div class="panel"><h3>匯出備份</h3><p class="muted">匯出專案、回報、通知與審計紀錄。</p><button class="btn" id="export-backup" type="button">下載 JSON 備份</button></div>' +
      '<div class="panel"><h3>匯入備份</h3><input type="file" id="import-backup-file" accept=".json,application/json" hidden><button class="btn ghost" id="choose-backup" type="button">選擇備份檔</button><div id="import-preview" style="margin-top:12px"></div></div>';

    document.getElementById('export-backup').addEventListener('click', function() {
      var payload = {
        exportVersion: 1,
        schemaVersion: Constants.SCHEMA_VERSION,
        appVersion: Constants.VERSION,
        exportedAt: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(db))
      };
      download(JSON.stringify(payload, null, 2), 'irr-tracker-backup-' + new Date().toISOString().slice(0, 10) + '.json');
      Runtime.audit('export', { resourceType: 'backup', resourceId: 'all', details: {}, summary: '匯出備份' });
    });

    var input = document.getElementById('import-backup-file');
    document.getElementById('choose-backup').addEventListener('click', function() { input.click(); });
    input.addEventListener('change', function() {
      var file = input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        document.getElementById('import-preview').innerHTML = '<div class="err">備份檔不可超過 5 MB。</div>';
        return;
      }
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var parsed = JSON.parse(reader.result);
          var data = parsed.data || parsed;
          if (parsed.exportVersion && parsed.schemaVersion !== Constants.SCHEMA_VERSION) throw new Error('備份版本與目前系統不相容。');
          if (!data || !Array.isArray(data.projects)) throw new Error('備份格式不正確。');
          var reportCount = data.projects.reduce(function(total, project) { return total + Object.keys(project.reports || {}).length; }, 0);
          document.getElementById('import-preview').innerHTML = '<div class="note">備份預覽：' + data.projects.length + ' 個專案、' + reportCount + ' 筆回報。確認匯入會完全取代目前資料。</div>' +
            '<button class="btn danger" id="confirm-import" type="button">確認取代並匯入</button>';
          document.getElementById('confirm-import').addEventListener('click', function() {
            Runtime.confirm('確認匯入備份', '<p>目前的 ' + db.projects.length + ' 個專案將被備份資料取代，且無法自動復原。</p>', function() {
              var imported = Storage.import ? Storage.import(JSON.stringify(data)) : null;
              if (!imported) { Runtime.toast('備份資料無法匯入'); return; }
              State.setDb(imported);
              Runtime.audit('import', { resourceType: 'backup', resourceId: 'all', details: { projects: imported.projects.length }, summary: '匯入備份' });
              window.AppRouter.navigate('/overview');
            }, { danger: true, okLabel: '確認匯入' });
          });
        } catch (error) {
          document.getElementById('import-preview').innerHTML = '<div class="err">' + Esc.escape(error.message) + '</div>';
        }
      };
      reader.readAsText(file);
    });
  }

  function download(text, filename) {
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  window.Views = window.Views || {};
  window.Views.backup = { render: render };

})(typeof window !== 'undefined' ? window : globalThis);
