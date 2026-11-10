/**
 * src/engine/formula-engine.js
 * Excel 公式計算引擎
 * 
 * 負責：
 * - 公式解析 (parse)
 * - 函數庫實現 (SUM, IRR, NPV 等)
 * - 計算引擎 (makeCalc, evalNode)
 */

(function(root) {
  'use strict';

  // 註：完整的公式引擎代碼已整合到 irr-engine.js
  // 此檔案作為獨立模組的接口

  window.FormulaEngine = {
    // 注意：實際實現在 irr-engine.js 中
    // 這裡提供方便的接口
    parse: function(src) {
      if (window.IRREngine && window.IRREngine.parse) {
        return window.IRREngine.parse(src);
      }
      throw new Error('IRREngine not loaded');
    },

    makeCalc: function(wb, overrides) {
      if (window.IRREngine && window.IRREngine.makeCalc) {
        return window.IRREngine.makeCalc(wb, overrides);
      }
      throw new Error('IRREngine not loaded');
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
