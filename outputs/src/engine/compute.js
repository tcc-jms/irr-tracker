/**
 * src/engine/compute.js
 * 高階計算接口
 * 
 * 提供應用程式層級的計算接口，
 * 封裝複雜的 IRR Engine 細節
 */

(function(root) {
  'use strict';

  var IRREngine = window.IRREngine || {};

  function errorResult(error) {
    return { error: error, irr: null, payback: null, fallbacks: [] };
  }

  /**
   * 計算 IRR 和相關指標
   * @param {Object} wb - 工作簿物件
   * @param {Object} overrides - 參數覆蓋
   * @returns {Object} 計算結果
   */
  function calculateIRR(wb, overrides) {
    try {
      if (!IRREngine.makeCalc || !IRREngine.findIrrSheet || !IRREngine.analyzeIrr || !IRREngine.snapshot) {
        return errorResult('IRREngine not ready');
      }
      var sheet = IRREngine.findIrrSheet(wb);
      if (!sheet) return errorResult('No IRR sheet found');
      var model = IRREngine.analyzeIrr(wb, sheet);
      var calc = IRREngine.makeCalc(wb, overrides);
      var result = IRREngine.snapshot(calc, model);
      result.error = null;
      result.sheet = sheet;
      result.model = model;
      result.fallbacks = calc.fallbacks || [];
      return result;
    } catch (e) {
      return errorResult(e.message);
    }
  }

  /**
   * 分析 Excel 工作簿中的 IRR 結構
   * @param {Object} wb - 工作簿物件
   * @returns {Object} IRR 分析結果
   */
  function analyzeWorkbook(wb) {
    try {
      if (!IRREngine.findIrrSheet || !IRREngine.analyzeIrr) {
        return { error: 'IRREngine not ready', sheet: null, model: null };
      }
      var sheet = IRREngine.findIrrSheet(wb);
      if (!sheet) {
        return {
          error: 'No IRR sheet found',
          sheet: null,
          model: null
        };
      }

      var model = IRREngine.analyzeIrr(wb, sheet);
      return {
        error: null,
        sheet: sheet,
        model: model
      };
    } catch (e) {
      return {
        error: e.message,
        sheet: null,
        model: null
      };
    }
  }

  /**
   * 驗證 Excel 檔案格式
   * @param {Object} wb - 工作簿物件
   * @returns {Object} 驗證結果
   */
  function validateWorkbook(wb) {
    var valid = !!(wb && wb.sheets && Array.isArray(wb.order) && wb.order.length > 0);
    var sheet = valid && IRREngine.findIrrSheet ? IRREngine.findIrrSheet(wb) : null;
    return {
      isValid: valid,
      sheets: valid ? wb.order.length : 0,
      hasIRRSheet: !!sheet,
      sheet: sheet
    };
  }

  function calculateProject(project, liveEdit) {
    if (!project || !project.model || !project.wb || !IRREngine.buildOverrides || !IRREngine.makeCalc || !IRREngine.snapshot) {
      return errorResult('Invalid project or IRREngine not ready');
    }
    try {
      var actuals = {}, params = {};
      var reports = project.reports || {};
      Object.keys(reports).forEach(function(year) {
        actuals[year] = Object.assign({}, reports[year].values || {});
        Object.assign(params, reports[year].params || {});
      });
      if (liveEdit) {
        actuals[liveEdit.year] = Object.assign({}, actuals[liveEdit.year] || {}, liveEdit.values || {});
      }
      var overrides = IRREngine.buildOverrides(
        project.model,
        project.baseline,
        actuals,
        params,
        project.mode,
        project.reportRows
      );
      var calc = IRREngine.makeCalc(project.wb, overrides);
      var result = IRREngine.snapshot(calc, project.model);
      result.error = null;
      result.fallbacks = calc.fallbacks || [];
      return result;
    } catch (e) {
      return errorResult(e.message);
    }
  }

  function isPlaceholderRow(row, baselineRows) {
    if (!row || row.kind !== 'detail') return false;
    var description = String(row.label || '').replace(/^\s*\d+(?:\.\d+)*\s*/, '').replace(/[:：]/g, '').trim();
    if (description) return false;
    var values = baselineRows && baselineRows[row.row] || {};
    return (row.yearCells || []).every(function(cell) {
      var value = values[cell.year];
      return value == null || value === '' || (typeof value === 'number' && Math.abs(value) < 1e-9);
    });
  }

  function getReportRows(model, baseline) {
    var rows = [];
    (model && model.sections || []).slice(0, 2).forEach(function(section) {
      (section.rows || []).forEach(function(row) {
        if (row.kind === 'detail' && row.defaultMode === 'report' && !isPlaceholderRow(row, baseline && baseline.rows)) rows.push(row.row);
      });
    });
    return rows;
  }

  window.AppCompute = {
    calculateIRR: calculateIRR,
    analyzeWorkbook: analyzeWorkbook,
    validateWorkbook: validateWorkbook,
    calculateProject: calculateProject,
    isPlaceholderRow: isPlaceholderRow,
    getReportRows: getReportRows
  };

})(typeof window !== 'undefined' ? window : globalThis);
