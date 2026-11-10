/**
 * src/views/overview.js
 * 概覽頁面
 */

(function(root) {
  'use strict';

  var State = window.AppState || {};
  var Notifications = window.AppNotifications || {};
  var Compute = window.AppCompute || {};
  var Esc = window.AppEsc || {};
  var Format = window.AppFormat || {};

  function escapeHtml(value) {
    return Esc.escape ? Esc.escape(value) : String(value == null ? '' : value);
  }

  function field(project, name) {
    if (project[name] != null && project[name] !== '') return project[name];
    return project.meta && project.meta[name] != null ? project.meta[name] : '';
  }

  function render() {
    var appEl = document.getElementById('app');
    if (!appEl) return;

    var state = State.state || {};
    var db = state.db || {};
    var projects = Array.isArray(db.projects) ? db.projects : [];
    var filters = state.overviewFilter || { q: '', plant: '', status: '', sort: 'default' };
    var query = String(filters.q || '').trim().toLowerCase();
    var today = db.today || new Date().toISOString().slice(0, 10);
    var rows = projects.map(function(project) {
      var schedule = Notifications.scheduleProject ? Notifications.scheduleProject(project, today) : [];
      var current = Notifications.currentPeriod ? Notifications.currentPeriod(project, today) : null;
      var snapshot = Compute.calculateProject ? Compute.calculateProject(project) : {};
      var reports = project.reports || {};
      var reportCount = Object.keys(reports).length;
      var baselineIrr = project.baseline && project.baseline.irr;
      var diff = reportCount && typeof snapshot.irr === 'number' && typeof baselineIrr === 'number' ? snapshot.irr - baselineIrr : null;
      return { project: project, schedule: schedule, current: current, snapshot: snapshot, reportCount: reportCount, diff: diff };
    });
    var plantSet = {};
    rows.forEach(function(row) {
      var plant = field(row.project, 'plant');
      if (plant) plantSet[plant] = true;
    });
    var plants = Object.keys(plantSet).sort();
    var filtered = rows.filter(function(row) {
      var project = row.project;
      var values = [field(project, 'name'), field(project, 'owner'), field(project, 'plant'), field(project, 'code'), project.fileName];
      var matchesQuery = !query || values.some(function(value) {
        return value != null && String(value).toLowerCase().indexOf(query) !== -1;
      });
      var matchesStatus = !filters.status || row.current && row.current.status === filters.status;
      return matchesQuery && matchesStatus && (!filters.plant || field(project, 'plant') === filters.plant);
    });
    var rank = { late: 0, due: 1, idle: 2, ok: 3 };
    if (filters.sort === 'overdue') filtered.sort(function(a, b) {
      var left = rank[a.current && a.current.status];
      var right = rank[b.current && b.current.status];
      return (left == null ? 9 : left) - (right == null ? 9 : right);
    });
    if (filters.sort === 'irr_d') filtered.sort(function(a, b) { return (b.diff == null ? -Infinity : b.diff) - (a.diff == null ? -Infinity : a.diff); });
    if (filters.sort === 'irr_a') filtered.sort(function(a, b) { return (a.diff == null ? Infinity : a.diff) - (b.diff == null ? Infinity : b.diff); });

    var plantOptions = '<option value="">全部廠區</option>';
    plants.forEach(function(plant) {
      plantOptions += '<option value="' + escapeHtml(plant) + '"' + (filters.plant === plant ? ' selected' : '') + '>' + escapeHtml(plant) + '</option>';
    });

    var rowsHtml = filtered.map(function(row) {
      var project = row.project;
      var current = row.current;
      var baselineIrr = project.baseline && project.baseline.irr;
      var actualIrr = row.snapshot.irr;
      var statusLabels = { ok: '已回報', due: '待回報', late: '逾期', idle: '未到期' };
      var statusClass = current ? current.status : 'idle';
      var needAction = current && (current.status === 'due' || current.status === 'late');
      var updatedAt = project.updatedAt || project.createdAt || project.uploadedAt || '–';
      return '<tr class="clickable" data-project="' + escapeHtml(project.id) + '">' +
        '<td><b>' + escapeHtml(field(project, 'name') || project.fileName || project.id || '未命名專案') + '</b><div class="small muted">' + escapeHtml(field(project, 'owner')) + (field(project, 'code') ? ' · ' + escapeHtml(field(project, 'code')) : '') + '</div></td>' +
        '<td>' + escapeHtml(field(project, 'plant') || '–') + '</td>' +
        '<td class="num">' + (Format.fmtPercent ? Format.fmtPercent(baselineIrr, 2) : '–') + '</td>' +
        '<td class="num">' + (row.reportCount ? Format.fmtPercent(actualIrr, 2) : '<span class="muted">–</span>') + '</td>' +
        '<td class="num ' + (row.diff > 0 ? 'd-pos' : row.diff < 0 ? 'd-neg' : '') + '">' + (row.diff == null ? '–' : Format.percentagePoints(row.diff)) + '</td>' +
        '<td class="num">' + row.reportCount + ' / ' + escapeHtml(project.model && project.model.horizon || 0) + ' 年</td>' +
        '<td><span class="tag ' + statusClass + '">第' + (current ? current.year : '–') + '年 ' + (statusLabels[statusClass] || '') + '</span></td>' +
        '<td class="num small">' + escapeHtml(current && current.due || '–') + '</td>' +
        '<td><a class="btn sm ' + (needAction ? '' : 'ghost') + '" href="#project/' + encodeURIComponent(project.id) + '" data-open-project="' + escapeHtml(project.id) + '">' + (needAction ? '填寫回報' : '查看') + '</a></td>' +
        '</tr>';
    }).join('');

    if (!filtered.length) {
      rowsHtml = '<tr><td colspan="9" class="empty">' + (projects.length ? '沒有符合篩選條件的專案。' : '還沒有追蹤專案。 <a href="#upload">上傳提報 Excel</a>') + '</td></tr>';
    }
    var pending = Notifications.pendingCount ? Notifications.pendingCount(db, today) : 0;

    appEl.innerHTML = '<h2>追蹤總覽</h2>' +
      '<p class="lead">共 ' + projects.length + ' 個追蹤專案，' + (pending ? '<b>' + pending + '</b> 筆年度回報待處理。' : '目前沒有待處理的年度回報。') + '</p>' +
      '<div class="panel"><div class="grid2">' +
      '<label class="f"><span>搜尋</span><input type="text" id="overview-query" placeholder="專案名稱／負責人／廠區／代號" value="' + escapeHtml(filters.q || '') + '"></label>' +
      '<label class="f"><span>廠區</span><select id="overview-plant">' + plantOptions + '</select></label>' +
      '<label class="f"><span>本期狀態</span><select id="overview-status"><option value="">全部狀態</option><option value="ok"' + (filters.status === 'ok' ? ' selected' : '') + '>已回報</option><option value="due"' + (filters.status === 'due' ? ' selected' : '') + '>待回報</option><option value="late"' + (filters.status === 'late' ? ' selected' : '') + '>逾期</option><option value="idle"' + (filters.status === 'idle' ? ' selected' : '') + '>未到期</option></select></label>' +
      '<label class="f"><span>排序</span><select id="overview-sort"><option value="default">預設</option><option value="overdue"' + (filters.sort === 'overdue' ? ' selected' : '') + '>逾期優先</option><option value="irr_d"' + (filters.sort === 'irr_d' ? ' selected' : '') + '>IRR 差異：高至低</option><option value="irr_a"' + (filters.sort === 'irr_a' ? ' selected' : '') + '>IRR 差異：低至高</option></select></label>' +
      '</div><button class="btn ghost sm" id="overview-reset" type="button">清除篩選</button></div>' +
      '<div class="panel" style="padding:0;overflow-x:auto"><table><thead><tr><th>專案</th><th>廠區</th><th class="num">原提報 IRR</th><th class="num">實際 IRR</th><th class="num">差異</th><th class="num">已回報</th><th>本期狀態</th><th>截止日</th><th></th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';

    var queryInput = document.getElementById('overview-query');
    queryInput.addEventListener('input', function() {
      var position = queryInput.selectionStart;
      if (State.updateFilter) State.updateFilter({ q: queryInput.value });
      render();
      queryInput = document.getElementById('overview-query');
      queryInput.focus();
      queryInput.setSelectionRange(position, position);
    });

    document.getElementById('overview-plant').addEventListener('change', function() {
      if (State.updateFilter) State.updateFilter({ plant: this.value });
      render();
    });
    document.getElementById('overview-status').addEventListener('change', function() {
      if (State.updateFilter) State.updateFilter({ status: this.value });
      render();
    });
    document.getElementById('overview-sort').addEventListener('change', function() {
      if (State.updateFilter) State.updateFilter({ sort: this.value });
      render();
    });
    appEl.querySelectorAll('tr[data-project]').forEach(function(row) {
      row.addEventListener('click', function(event) {
        if (event.target.closest('a')) return;
        window.AppRouter.navigate('/project/' + encodeURIComponent(row.getAttribute('data-project')));
      });
    });

    document.getElementById('overview-reset').addEventListener('click', function() {
      if (State.updateFilter) State.updateFilter({ q: '', plant: '', status: '', sort: 'default' });
      render();
    });
  }

  window.Views = window.Views || {};
  window.Views.overview = { render: render };

})(typeof window !== 'undefined' ? window : globalThis);
