/**
 * src/components/tracker-actions.js
 * Tracker 表格操作
 */

(function(root) {
  'use strict';

  var Compute = window.AppCompute || {};

  function saveYear(project, year, values) {
    var runtime = window.AppRuntime;
    var state = window.AppState && window.AppState.state;
    var notifications = window.AppNotifications;
    if (!runtime || !project || !state || !state.db) return false;
    // 確保使用系統封裝好的今日標準格式，若抓不到則用安全預設值
    var dates = window.AppDates || {};
    var realToday = dates.today ? dates.today() : new Date().toISOString().slice(0, 10);
    var targetYear = Number(year);

    // 強制重新計算 Schedule（解決資料庫 cache 的 today 過期的問題）
    var schedule = notifications.scheduleProject(project, realToday);
    var status = schedule.filter(function(item) { return item.year === targetYear; })[0];

    if (!status || ['due', 'late', 'ok'].indexOf(status.status) === -1) {
      // 若想確認為何失敗，可以暫時把這行取消註解來看真實數值：
      runtime.toast('目前日期:' + realToday + '，預期狀態:' + (status ? status.status : '無'));
      //runtime.toast('此年度尚未開放回報');
      return false;
    }
    var reportRows = Compute.getReportRows ? Compute.getReportRows(project.model, project.baseline) : project.reportRows || [];
    var normalizedValues = {};
    (project.model.sections || []).slice(0, 2).forEach(function(section) {
      section.rows.forEach(function(row) {
        if (reportRows.indexOf(row.row) === -1 || (project.reportRows || []).indexOf(row.row) === -1) return;
        var cell = row.yearCells.filter(function(item) { return item.year === year; })[0];
        if (!cell) return;
        var value = values[cell.addr];
        normalizedValues[cell.addr] = value === undefined || value === null || value === '' ? 0 : Number(value);
      });
    });
    if (Object.keys(normalizedValues).some(function(address) { return !isFinite(normalizedValues[address]); })) {
      runtime.toast('回報內容含有無效數字');
      return false;
    }
    var before = project.reports && project.reports[year] || null;
    project.reports = project.reports || {};
    var result = Compute.calculateProject(project, { year: year, values: normalizedValues });
    if (result.error) {
      runtime.toast('無法計算回報：' + result.error);
      return false;
    }
    project.reports[year] = {
      values: normalizedValues,
      params: {},
      notes: {},
      at: state.db.today,
      updatedAt: state.db.today,
      irrAfter: result.irr
    };
    runtime.liveEdit = null;
    runtime.audit(before ? 'edit_report' : 'submit_report', {
      resourceType: 'report',
      resourceId: project.id,
      details: { year: year, before: before, after: project.reports[year] },
      summary: '儲存第 ' + year + ' 年回報'
    });
    runtime.toast('第 ' + year + ' 年回報已儲存');
    return true;
  }

  function editReport(project, year) {
    if (!project || !project.reports || !project.reports[year]) return null;
    var edit = { year: year, values: Object.assign({}, project.reports[year].values || {}) };
    if (window.AppRuntime) window.AppRuntime.liveEdit = edit;
    return edit;
  }

  function deleteReport(project, year, onComplete) {
    if (!project || !project.reports || !project.reports[year]) return;
    var runtime = window.AppRuntime;
    var state = window.AppState && window.AppState.state;
    if (!runtime || !state || !state.db) return;
    runtime.confirm('確認刪除回報', '<p>確定要刪除第 <b>' + year + '</b> 年的回報資料？此操作無法復原。</p>', function() {
      var previous = project.reports[year];
      delete project.reports[year];
      runtime.liveEdit = null;
      runtime.audit('delete_report', {
        resourceType: 'report',
        resourceId: project.id,
        details: { year: year, before: previous },
        summary: '刪除第 ' + year + ' 年回報'
      });
      runtime.toast('第 ' + year + ' 年回報已刪除');
      if (onComplete) onComplete();
    }, { danger: true, okLabel: '確認刪除' });
  }

  window.AppTrackerActions = {
    saveYear: saveYear,
    editReport: editReport,
    deleteReport: deleteReport
  };

})(typeof window !== 'undefined' ? window : globalThis);
