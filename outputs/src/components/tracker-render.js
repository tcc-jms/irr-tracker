/**
 * src/components/tracker-render.js
 * Tracker 表格渲染
 */

(function(root) {
  'use strict';

  var Esc = window.AppEsc || {};
  var Format = window.AppFormat || {};
  var Compute = window.AppCompute || {};

  function escape(value) {
    return Esc.escape ? Esc.escape(value) : String(value == null ? '' : value);
  }

  function formatValue(value) {
    if (value && value.err) return '<span class="d-neg">' + escape(value.err) + '</span>';
    if (typeof value !== 'number' || !isFinite(value)) return '<span class="muted">–</span>';
    return '<span class="' + (value < 0 ? 'd-neg' : '') + '">' + (Format.formatNumber ? Format.formatNumber(value, 0) : String(value)) + '</span>';
  }

  function yearSchedule(schedule) {
    var map = {};
    (schedule || []).forEach(function(item) { map[item.year] = item; });
    return map;
  }

  function buildTracker(data) {
    data = data || {};
    var project = data.project || {};
    var model = project.model || {};
    var years = model.yearCols || [];
    var sections = (model.sections || []).slice(0, 4);
    var schedule = yearSchedule(data.schedule);
    var baselineRows = project.baseline && project.baseline.rows || {};
    var actualRows = data.snapshot && data.snapshot.rows || {};
    var liveEdit = data.liveEdit;
    var reportRows = project.reportRows || [];
    var headers = '<tr><th class="tracker-label-head">效益項目</th>';

    years.forEach(function(item) {
      var state = schedule[item.year];
      var open = item.year > 0 && state && (state.status === 'due' || state.status === 'late' || state.status === 'ok');
      var period = item.year === 0 ? '初始投資' : state ? state.periodStart.slice(0, 7) + '～' + state.periodEnd.slice(0, 7) : '';
      var actions = project.reports && project.reports[item.year]
        ? '<button class="yr-menu-btn danger" type="button" data-delete-report="' + item.year + '" title="刪除此年回報">刪除</button>'
        : '';
        headers += '<th colspan="' + (open ? 2 : 1) + '" class="year-divider"><div class="yr-head-wrap"><div class="yr-name">' + (item.year === 0 ? '第 0 年' : '第 ' + item.year + ' 年') + ' ' + actions + '</div>' +
          '<div class="yr-period">' + escape(period) + '</div><div class="yr-status">' + escape(state ? ({ ok: '已回報', due: '待回報', late: '逾期', idle: '未到期' }[state.status]) : '') + '</div>' +
          '<div class="yr-sub"><span class="yr-sub-cell">提報</span>' + (open ? '<span class="yr-sub-cell act-label">實際</span>' : '') + '</div></div></th>';      
      });
    headers += '</tr>';

    var body = '';
    sections.forEach(function(section) {
      var mainRow = section.mainRow;
      body += '<tr class="tracker-section"><th>' + escape('(' + section.no + ') ' + section.title) + '</th>';
      years.forEach(function(item) {
        var state = schedule[item.year];
        var open = item.year > 0 && state && (state.status === 'due' || state.status === 'late' || state.status === 'ok');
        var value = mainRow && baselineRows[mainRow] ? baselineRows[mainRow][item.year] : null;
        var planCls = 'num col-plan' + (open ? '' : ' year-divider');
        var actCls = 'num col-act year-divider';
        body += '<td class="' + planCls + '">' + formatValue(value) + '</td>' + 
                (open ? '<td class="' + actCls + '">' + formatValue(actualRows[mainRow] && actualRows[mainRow][item.year]) + '</td>' : '');
      });
      body += '</tr>';

      if (section.no > 2) return;
      section.rows.forEach(function(row) {
        if (row.row === section.row || row.kind === 'group' || Compute.isPlaceholderRow && Compute.isPlaceholderRow(row, baselineRows)) return;
        var isSubtotal = row.kind === 'subtotal';
        var canReport = row.kind === 'detail' && reportRows.indexOf(row.row) !== -1;
        body += '<tr class="' + (isSubtotal ? 'tracker-subtotal' : '') + '"><th>' + escape(row.label) + '</th>';
        years.forEach(function(item) {
          var state = schedule[item.year];
          var open = item.year > 0 && state && (state.status === 'due' || state.status === 'late' || state.status === 'ok');
          var cell = row.yearCells.filter(function(yearCell) { return yearCell.year === item.year; })[0];
          var plan = cell && baselineRows[row.row] ? baselineRows[row.row][item.year] : null;
          var planCls = 'num col-plan' + (open ? '' : ' year-divider');
          body += '<td class="' + planCls + '">' + (cell ? formatValue(plan) : '') + '</td>';
          if (!open) return;
          if (canReport && cell) {
            var value = liveEdit && liveEdit.year === item.year ? liveEdit.values[cell.addr] :
              project.reports && project.reports[item.year] && project.reports[item.year].values && project.reports[item.year].values[cell.addr];
            // 加上 year-divider 以及 col-act
            body += '<td class="col-act year-divider"><input class="t-inp" type="text" data-year="' + item.year + '" data-addr="' + escape(cell.addr) + '" value="' + escape(value) + '"></td>';
          } else {
            var actVal = project.reports && project.reports[item.year] && project.reports[item.year].values ? project.reports[item.year].values[cell.addr] : null;
            // 加上 year-divider 以及 col-act
            body += '<td class="num col-act year-divider">' + (cell ? formatValue(actVal) : '') + '</td>';
          }
        });
        body += '</tr>';
      });
    });

    return '<div class="tracker-table-scroll"><table class="tracker-table"><thead>' + headers + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function buildIrrBar(data) {
    data = data || {};
    var project = data.project || {};
    var baseline = project.baseline || {};
    var snapshot = data.snapshot || {};
    var hasReport = Object.keys(project.reports || {}).length > 0 || !!data.liveEdit;
    var baseIrr = baseline.irr;
    var actualIrr = snapshot.irr;
    var diff = typeof actualIrr === 'number' && typeof baseIrr === 'number' ? actualIrr - baseIrr : null;
    var diffText = Format.percentagePoints ? Format.percentagePoints(diff) : '–';
    return '<div class="irr-bar" id="irr-bar"><div class="irr-bar-inner">' +
      '<div class="irr-fig plan"><span class="l">原提報 IRR</span><span class="v">' + (Format.fmtPercent ? Format.fmtPercent(baseIrr, 2) : '–') + '</span></div>' +
      '<span class="irr-arrow">→</span><div class="irr-fig act"><span class="l">實際 IRR</span><span class="v">' + (hasReport && Format.fmtPercent ? Format.fmtPercent(actualIrr, 2) : '–') + '</span></div>' +
      '<div class="irr-diff ' + (diff == null ? '' : diff >= 0 ? 'pos' : 'neg') + '">' + (hasReport ? diffText : '尚無實績') + '</div>' +
      '<div>回收年限：' + (Format.formatNumber ? Format.formatNumber(baseline.payback, 1) : '–') + ' → ' + (hasReport && Format.formatNumber ? Format.formatNumber(snapshot.payback, 1) : '–') + ' 年</div>' +
      '</div><div class="irr-save"><button class="save-btn" id="save-yr"' + (data.canSave ? '' : ' disabled') + '>儲存回報</button>' +
      '<button class="save-btn" id="cancel-edit" type="button"' + (data.liveEdit ? '' : ' disabled') + '>取消</button></div></div>';
  }

  window.AppTrackerRender = {
    buildTracker: buildTracker,
    buildIrrBar: buildIrrBar
  };

})(typeof window !== 'undefined' ? window : globalThis);
