/**
 * src/views/project.js
 * 專案詳情頁面
 */

(function(root) {
  'use strict';

  var State = window.AppState || {};
  var Runtime = window.AppRuntime || {};
  var Notifications = window.AppNotifications || {};
  var Compute = window.AppCompute || {};
  var Esc = window.AppEsc || {};
  var Format = window.AppFormat || {};
  var TrackerRender = window.AppTrackerRender || {};
  var TrackerBind = window.AppTrackerBind || {};
  var TrackerActions = window.AppTrackerActions || {};

  function escape(value) {
    return Esc.escape ? Esc.escape(value) : String(value == null ? '' : value);
  }

  function render(projectId) {
    var appEl = document.getElementById('app');
    if (!appEl) return;
    var db = State.state && State.state.db;
    var project = db && db.projects.filter(function(item) { return item.id === projectId; })[0];
    if (!project) {
      appEl.innerHTML = '<div class="empty">找不到這個專案。<br><br><a href="#overview">回到總覽</a></div>';
      return;
    }

    var today = db.today;
    var schedule = Notifications.scheduleProject(project, today);
    var liveEdit = Runtime.liveEdit;
    var snapshot = Compute.calculateProject(project, liveEdit);
    var reportCount = Object.keys(project.reports || {}).length;
    var canSave = !!liveEdit;
    var statusByYear = {};
    schedule.forEach(function(item) { statusByYear[item.year] = item; });
    var current = Notifications.currentPeriod(project, today);
    var contacts = project.contacts || { plant: '', hq: '' };

    appEl.innerHTML = '<p class="small"><a href="#overview">← 追蹤總覽</a></p>' +
      '<h2>' + escape(project.name) + '</h2>' +
      '<p class="lead">' + [project.plant, project.code, project.owner ? '負責人 ' + project.owner : ''].filter(Boolean).map(escape).join('　') +
      (project.fileName ? ' · <span class="muted small">' + escape(project.fileName) + '</span>' : '') + '</p>' +
      '<div class="panel irr-hero"><div class="fig plan"><div class="lab">原提報 IRR</div><div class="val">' + Format.fmtPercent(project.baseline && project.baseline.irr, 2) + '</div></div>' +
      '<div class="slope"></div><div class="fig act"><div class="lab">' + (reportCount || liveEdit ? '實際 IRR' : '實際 IRR') + '</div><div class="val" id="project-actual-irr">' + (reportCount || liveEdit ? Format.fmtPercent(snapshot.irr, 2) : '–') + '</div></div>' +
      '<div class="delta small"><div>IRR 差異 <b id="project-irr-diff">' + (reportCount || liveEdit ? Format.percentagePoints(snapshot.irr - project.baseline.irr) : '尚無實績') + '</b></div>' +
      '<div>回收年限 <b>' + Format.formatNumber(project.baseline && project.baseline.payback, 1) + '</b> → <b id="project-payback">' + (reportCount || liveEdit ? Format.formatNumber(snapshot.payback, 1) : '–') + '</b> 年</div>' +
      '<div class="seg" id="mode-seg"><button type="button" data-mode="formula" class="' + (project.mode === 'formula' ? 'on' : '') + '">依公式延伸</button><button type="button" data-mode="original" class="' + (project.mode === 'original' ? 'on' : '') + '">維持提報值</button></div></div></div>' +
      (snapshot.error ? '<div class="err">計算錯誤：' + escape(snapshot.error) + '</div>' : '') +
      (snapshot.fallbacks && snapshot.fallbacks.length ? '<div class="note">有 ' + snapshot.fallbacks.length + ' 個公式使用備援值，結果可能不準確。</div>' : '') +
      '<div class="panel" style="padding:0;overflow:hidden"><div style="padding:14px 20px 10px;border-bottom:1px solid var(--line)"><h3 style="margin:0">效益追蹤總表</h3></div>' +
      (TrackerRender.buildTracker ? TrackerRender.buildTracker({ project: project, schedule: schedule, snapshot: snapshot, liveEdit: liveEdit }) : '') + '</div>' +
      '<div id="irr-bar-container">' + (TrackerRender.buildIrrBar ? TrackerRender.buildIrrBar({ project: project, schedule: schedule, snapshot: snapshot, liveEdit: liveEdit, canSave: canSave }) : '') + '</div>' +
      '<div class="panel"><h3>專案設定</h3><div class="grid2">' +
      '<label class="f"><span>專案名稱</span><input type="text" id="s-name" value="' + escape(project.name) + '"></label>' +
      '<label class="f"><span>預算代號</span><input type="text" id="s-code" value="' + escape(project.code || '') + '"></label>' +
      '<label class="f"><span>廠區</span><input type="text" id="s-plant" value="' + escape(project.plant || '') + '"></label>' +
      '<label class="f"><span>負責人</span><input type="text" id="s-owner" value="' + escape(project.owner || '') + '"></label>' +
      '<label class="f"><span>啟用日</span><input type="date" id="s-start" value="' + escape(project.startDate || '') + '"></label>' +
      '<label class="f"><span>寬限天數</span><input type="number" id="s-grace" min="1" max="365" value="' + escape(project.graceDays || 30) + '"></label>' +
      '<label class="f"><span>廠端 Email</span><input type="email" id="s-pe" value="' + escape(contacts.plant || '') + '"></label>' +
      '<label class="f"><span>總部 Email</span><input type="email" id="s-he" value="' + escape(contacts.hq || '') + '"></label>' +
      '</div><button class="btn sm" id="s-save" type="button">儲存設定</button><button class="btn sm danger" id="s-del" type="button">刪除專案</button></div>';

    appEl.querySelectorAll('#mode-seg button').forEach(function(button) {
      button.addEventListener('click', function() {
        project.mode = button.getAttribute('data-mode');
        Runtime.audit('update_project', { resourceType: 'project', resourceId: project.id, details: { mode: project.mode }, summary: '變更計算模式' });
        render(projectId);
      });
    });

    appEl.querySelectorAll('[data-edit-report]').forEach(function(button) {
      button.addEventListener('click', function(event) {
        event.stopPropagation();
        Runtime.liveEdit = TrackerActions.editReport(project, Number(button.getAttribute('data-edit-report')));
        render(projectId);
      });
    });
    appEl.querySelectorAll('[data-delete-report]').forEach(function(button) {
      button.addEventListener('click', function(event) {
        event.stopPropagation();
        TrackerActions.deleteReport(project, Number(button.getAttribute('data-delete-report')), function() { render(projectId); });
      });
    });

    document.getElementById('s-save').addEventListener('click', function() {
      var name = document.getElementById('s-name').value.trim();
      if (!name) return Runtime.toast('專案名稱不可空白');
      project.name = name;
      project.code = document.getElementById('s-code').value.trim();
      project.plant = document.getElementById('s-plant').value.trim();
      project.owner = document.getElementById('s-owner').value.trim();
      project.startDate = document.getElementById('s-start').value || project.startDate;
      project.graceDays = Math.max(1, Math.min(365, Number(document.getElementById('s-grace').value) || 30));
      project.contacts = { plant: document.getElementById('s-pe').value.trim(), hq: document.getElementById('s-he').value.trim() };
      project.updatedAt = db.today;
      Runtime.audit('update_project', { resourceType: 'project', resourceId: project.id, details: { name: name, plant: project.plant, owner: project.owner }, summary: '更新專案設定' });
      Runtime.toast('專案設定已儲存');
      render(projectId);
    });

    document.getElementById('s-del').addEventListener('click', function() {
      Runtime.confirm('確認刪除專案', '<p>確定要刪除「<b>' + escape(project.name) + '</b>」及所有回報紀錄？此操作無法復原。</p>', function() {
        db.projects = db.projects.filter(function(item) { return item.id !== project.id; });
        db.notices = (db.notices || []).filter(function(item) { return item.pid !== project.id; });
        Runtime.audit('delete_project', { resourceType: 'project', resourceId: project.id, details: { name: project.name }, summary: '刪除專案' });
        window.AppRouter.navigate('/overview');
      }, { danger: true, okLabel: '確認刪除' });
    });

    if (TrackerBind.bindTracker) TrackerBind.bindTracker(appEl, {
      onFocus: function(input) {
        var year = Number(input.getAttribute('data-year'));
        if (!Runtime.liveEdit || Runtime.liveEdit.year !== year) {
          var saved = project.reports && project.reports[year];
          Runtime.liveEdit = { year: year, values: Object.assign({}, saved && saved.values || {}) };
        }
        var saveButton = document.getElementById('save-yr');
        if (saveButton) saveButton.disabled = false;
        var cancelButton = document.getElementById('cancel-edit');
        if (cancelButton) cancelButton.disabled = false;
      },
      onInput: function(input) {
        var value = input.value.trim();
        var number = value === '' ? null : Number(value);
        input.setCustomValidity(value !== '' && !isFinite(number) ? '請輸入有效數字' : '');
        if (value !== '' && !isFinite(number)) return;
        var edit = Runtime.liveEdit;
        if (!edit) return;
        if (value === '') delete edit.values[input.getAttribute('data-addr')];
        else edit.values[input.getAttribute('data-addr')] = number;
        input.classList.toggle('filled', value !== '');
        var updated = Compute.calculateProject(project, edit);
        var actual = document.getElementById('project-actual-irr');
        var diff = document.getElementById('project-irr-diff');
        var payback = document.getElementById('project-payback');
        if (actual) actual.textContent = Format.fmtPercent(updated.irr, 2);
        if (diff) diff.textContent = Format.percentagePoints(updated.irr - project.baseline.irr);
        if (payback) payback.textContent = Format.formatNumber(updated.payback, 1);
      },
      onSave: function() {
        var edit = Runtime.liveEdit;
        if (edit && TrackerActions.saveYear(project, edit.year, edit.values)) render(projectId);
      },
      onCancel: function() { Runtime.liveEdit = null; render(projectId); }
    });
  }

  window.Views = window.Views || {};
  window.Views.project = { render: render };

})(typeof window !== 'undefined' ? window : globalThis);
