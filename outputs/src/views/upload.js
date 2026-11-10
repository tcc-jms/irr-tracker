/**
 * src/views/upload.js
 * Excel 上傳頁面
 */

(function(root) {
  'use strict';

  var State = window.AppState || {};
  var Runtime = window.AppRuntime || {};
  var Engine = window.IRREngine || {};
  var Compute = window.AppCompute || {};
  var Constants = window.AppConstants || {};
  var Esc = window.AppEsc || {};
  var Format = window.AppFormat || {};

  function escape(value) {
    return Esc.escape ? Esc.escape(value) : String(value == null ? '' : value);
  }

  async function inflateRaw(bytes) {
    if (!window.DecompressionStream) throw new Error('此瀏覽器不支援 Excel 解壓，請更新瀏覽器。');
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function render() {
    var appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = '<h2>上傳提報 Excel</h2><p class="lead">選擇資本支出提報檔，系統會在瀏覽器解析後建立雲端追蹤專案。</p>' +
      '<div class="panel"><div class="drop" id="upload-drop" tabindex="0" role="button"><strong>拖曳 .xlsx 到這裡，或點選選擇檔案</strong><span class="muted small">檔案只在瀏覽器本機解析，不會上傳</span></div>' +
      '<input type="file" id="upload-file" accept=".xlsx,.xlsm" hidden><div id="upload-message"></div></div><div id="upload-preview"></div>';

    var drop = document.getElementById('upload-drop');
    var file = document.getElementById('upload-file');
    drop.addEventListener('click', function() { file.click(); });
    drop.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); file.click(); }
    });
    drop.addEventListener('dragover', function(event) { event.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function() { drop.classList.remove('over'); });
    drop.addEventListener('drop', function(event) {
      event.preventDefault();
      drop.classList.remove('over');
      if (event.dataTransfer.files[0]) handleFile(event.dataTransfer.files[0]);
    });
    file.addEventListener('change', function() {
      if (file.files[0]) handleFile(file.files[0]);
    });
    if (Runtime.draft) renderPreview(Runtime.draft);
  }

  async function handleFile(file) {
    var message = document.getElementById('upload-message');
    message.innerHTML = '<p class="muted">正在解析 ' + escape(file.name) + '…</p>';
    try {
      if (!Engine.parseWorkbook || !Engine.analyzeIrr || !Engine.makeCalc || !Engine.snapshot) {
        throw new Error('IRR 引擎尚未完成載入，請重新整理頁面。');
      }
      var bytes = new Uint8Array(await file.arrayBuffer());
      var workbook = await Engine.parseWorkbook(bytes, inflateRaw);
      var sheet = Engine.findIrrSheet(workbook);
      if (!sheet) throw new Error('檔案中找不到 IRR 工作表。工作表：' + workbook.order.join('、'));
      var model = Engine.analyzeIrr(workbook, sheet);
      var calculator = Engine.makeCalc(workbook, {});
      var baseline = Engine.snapshot(calculator, model);
      var title = calculator.get(sheet, model.titleCell);
      if (title && typeof title === 'object' && title.err) title = '';
      title = String(title || '').replace(/\s*IRR\s*計算\s*$/, '');
      Runtime.draft = {
        fileName: file.name,
        model: model,
        wb: Engine.extractNeeded ? Engine.extractNeeded(workbook, sheet) : workbook,
        baseline: baseline,
        meta: {
          name: title || Engine.findLabel(workbook, /支出項目|工程名稱/) || '',
          plant: Engine.findLabel(workbook, /^廠別[:：]?$/) || '',
          owner: Engine.findLabel(workbook, /工程負責人員|負責人員/) || '',
          code: Engine.findLabel(workbook, /預算代號/) || ''
        }
      };
      message.innerHTML = '<div class="okbox">已解析「' + escape(sheet) + '」工作表，原提報 IRR：<b>' + Format.fmtPercent(baseline.irr, 2) + '</b></div>';
      renderPreview(Runtime.draft);
    } catch (error) {
      Runtime.draft = null;
      document.getElementById('upload-preview').innerHTML = '';
      message.innerHTML = '<div class="err"><b>無法讀取。</b> ' + escape(error.message) + '</div>';
    }
  }

  function renderPreview(draft) {
    var preview = document.getElementById('upload-preview');
    if (!preview || !draft) return;
    var today = State.state && State.state.db && State.state.db.today || new Date().toISOString().slice(0, 10);
    var startDate = (Number(today.slice(0, 4)) + 1) + '-01-01';
    
    // 判斷系統抓取的廠區，設定下拉選單預設值
    var parsedPlant = escape(draft.meta.plant);
    var isSuao = parsedPlant.includes('蘇澳');
    var plantOptions = '<option value="和平廠"' + (!isSuao ? ' selected' : '') + '>和平廠</option>' +
                       '<option value="蘇澳廠"' + (isSuao ? ' selected' : '') + '>蘇澳廠</option>';

    // 簡化後的表單 UI：只保留 專案名稱、廠區(下拉)、啟用日
    preview.innerHTML = '<div class="panel"><h3>設定專案</h3><div class="grid2">' +
      '<label class="f"><span>專案名稱</span><input type="text" id="d-name" value="' + escape(draft.meta.name) + '"></label>' +
      '<label class="f"><span>廠區</span><select id="d-plant">' + plantOptions + '</select></label>' +
      '<label class="f"><span>啟用日</span><input type="date" id="d-start" value="' + startDate + '"></label></div>' +
      '<div id="create-error"></div><button class="btn" id="create-project" type="button">建立追蹤專案</button>' +
      '<button class="btn ghost" id="cancel-upload" type="button">取消</button></div>';

    document.getElementById('cancel-upload').addEventListener('click', function() {
      Runtime.draft = null;
      document.getElementById('upload-preview').innerHTML = '';
      document.getElementById('upload-message').innerHTML = '';
    });
    
    document.getElementById('create-project').addEventListener('click', function() {
      var name = document.getElementById('d-name').value.trim();
      if (!name) {
        document.getElementById('create-error').innerHTML = '<div class="err">請填寫專案名稱。</div>';
        return;
      }
      var db = State.state.db;
      var project = {
        id: window.StorageAPI.createProjectId(db.seq++),
        schemaVersion: Constants.SCHEMA_VERSION,
        name: name,
        
        // --- 修改點：移除欄位以空字串/預設值取代以防結構報錯 ---
        code: '', 
        owner: '', 
        contacts: { plant: '', hq: '' }, 
        graceDays: 0, // 預設 0 天 (後續移至管理者畫面設定)
        // -----------------------------------------------------

        plant: document.getElementById('d-plant').value,
        fileName: draft.fileName,
        uploadedAt: db.today,
        createdAt: db.today,
        updatedAt: db.today,
        startDate: document.getElementById('d-start').value || startDate,
        model: draft.model,
        wb: draft.wb,
        baseline: draft.baseline,
        reportRows: Compute.getReportRows ? Compute.getReportRows(draft.model, draft.baseline) : [],
        mode: 'formula',
        reports: {}
      };
      
      db.projects.push(project);
      Runtime.draft = null;
      Runtime.audit('create_project', { resourceType: 'project', resourceId: project.id, details: { name: project.name, fileName: project.fileName }, summary: '建立追蹤專案' });
      if (window.AppNotifications) window.AppNotifications.runScheduler(db, db.today);
      Runtime.toast('已建立追蹤專案');
      window.AppRouter.navigate('/project/' + encodeURIComponent(project.id));
    });
  }

  window.Views = window.Views || {};
  window.Views.upload = { render: render, handleFile: handleFile };

})(typeof window !== 'undefined' ? window : globalThis);
