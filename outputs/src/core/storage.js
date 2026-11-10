/**
 * src/core/storage.js
 * Supabase 專案資料存取、遷移、匯出/匯入
 */

(function(root) {
  'use strict';

  var C = window.AppConstants || {};
  var State = window.AppState || {};
  var syncedProjects = [];
  var saveQueue = Promise.resolve();
  var migrationNotice = '';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function migrateDb(raw) {
    if (!raw) return null;

    if (!raw.schemaVersion || raw.schemaVersion < 2) {
      raw.schemaVersion = 2;
      raw.auditLogs = raw.auditLogs || [];

      for (var i = 0; i < (raw.projects || []).length; i++) {
        var project = raw.projects[i];
        project.schemaVersion = 2;
        project.createdAt = project.uploadedAt || project.createdAt || raw.today || '';
        project.updatedAt = project.updatedAt || project.createdAt;
        if (!project.contacts) project.contacts = { plant: '', hq: '' };
        if (!project.reports) project.reports = {};
        if (!project.mode) project.mode = 'formula';
        if (!project.reportRows) project.reportRows = [];
      }
    }

    return raw;
  }

  function getClient() {
    if (!window.supabase) throw new Error('Supabase 尚未初始化，請確認網路連線並重新整理。');
    return window.supabase;
  }

  function readLegacyDb() {
    try {
      var serialized = window.localStorage.getItem(C.STORAGE_KEY);
      return serialized ? migrateDb(JSON.parse(serialized)) : null;
    } catch (error) {
      console.error('Failed to read local migration data:', error);
      migrationNotice = '無法讀取此瀏覽器的舊資料；雲端資料未受影響。';
      return null;
    }
  }

  function removeLegacyDb() {
    try {
      window.localStorage.removeItem(C.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove migrated local data:', error);
      migrationNotice = '專案已遷移至雲端，但無法清除本機舊資料。';
    }
  }

  function bytesToBase64(bytes) {
    var binary = '';
    var chunkSize = 0x8000;
    for (var offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function compressProject(project) {
    var projectData = clone(project);
    if (!projectData.wb || typeof CompressionStream === 'undefined') return projectData;

    var serializedWorkbook = JSON.stringify(projectData.wb);
    var stream = new Blob([serializedWorkbook]).stream().pipeThrough(new CompressionStream('gzip'));
    var compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    var encoded = bytesToBase64(compressed);
    if (encoded.length < serializedWorkbook.length) {
      delete projectData.wb;
      projectData.wbCompressed = { encoding: 'gzip-base64', data: encoded };
    }
    return projectData;
  }

  async function decompressProject(project) {
    if (!project.wbCompressed) return project;
    var compressed = project.wbCompressed;
    if (compressed.encoding !== 'gzip-base64' || typeof compressed.data !== 'string') {
      throw new Error('Supabase 專案的工作簿壓縮格式不支援。');
    }
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('此瀏覽器不支援解壓縮雲端工作簿，請更新瀏覽器。');
    }
    var stream = new Blob([base64ToBytes(compressed.data)])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    project.wb = JSON.parse(await new Response(stream).text());
    delete project.wbCompressed;
    return project;
  }

  async function normalizeProjects(rows) {
    return Promise.all((rows || []).map(async function(row) {
      if (!row || typeof row.id !== 'string' || !row.project_data ||
          typeof row.project_data !== 'object' || Array.isArray(row.project_data)) {
        throw new Error('Supabase projects 表含有格式不正確的資料，請檢查 project_data 欄位。');
      }
      var project = await decompressProject(row.project_data);
      project.id = row.id;
      return project;
    }));
  }

  async function loadProjectsFromSupabase() {
    var result = await getClient()
      .from('projects')
      .select('id, project_data')
      .order('updated_at', { ascending: false });
    if (result.error) {
      console.error('Supabase project load failed:', result.error);
      throw new Error('無法從 Supabase 載入專案：' + result.error.message);
    }
    return normalizeProjects(result.data);
  }

  function projectMap(projects) {
    var result = Object.create(null);
    (projects || []).forEach(function(project) {
      result[String(project.id)] = project;
    });
    return result;
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    var normalized = {};
    Object.keys(value).sort().forEach(function(key) {
      normalized[key] = stableValue(value[key]);
    });
    return normalized;
  }

  function sameValue(left, right) {
    return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
  }

  function sameProjects(left, right) {
    var leftMap = projectMap(left);
    var rightMap = projectMap(right);
    var leftIds = Object.keys(leftMap).sort();
    var rightIds = Object.keys(rightMap).sort();
    return sameValue(leftIds, rightIds) && leftIds.every(function(id) {
      return sameValue(leftMap[id], rightMap[id]);
    });
  }

  function getSaveChanges(projects) {
    var previous = projectMap(syncedProjects);
    var current = projectMap(projects);
    var upserts = [];
    var deletions = [];
    var changedIds = [];

    Object.keys(current).forEach(function(id) {
      if (!previous[id] || !sameValue(previous[id], current[id])) {
        var project = current[id];
        upserts.push({
          id: id,
          name: project.name || '',
          plant: project.plant || '',
          owner: project.owner || '',
          project_data: project,
          updated_at: new Date().toISOString()
        });
        changedIds.push(id);
      }
    });

    Object.keys(previous).forEach(function(id) {
      if (!current[id]) {
        deletions.push(id);
        changedIds.push(id);
      }
    });

    return {
      previous: previous,
      upserts: upserts,
      deletions: deletions,
      changedIds: changedIds
    };
  }

  function recordSyncedChanges(upserts, deletions) {
    var projects = projectMap(syncedProjects);
    (upserts || []).forEach(function(row) {
      projects[row.id] = clone(row.project_data);
    });
    (deletions || []).forEach(function(id) {
      delete projects[id];
    });
    syncedProjects = Object.keys(projects).map(function(id) {
      return projects[id];
    });
  }

  async function checkForConflicts(changes) {
    if (!changes.changedIds.length) return;
    var result = await getClient()
      .from('projects')
      .select('id, project_data')
      .in('id', changes.changedIds);
    if (result.error) {
      console.error('Supabase conflict check failed:', result.error);
      throw new Error('無法確認雲端專案是否已被其他同事修改：' + result.error.message);
    }

    var remote = projectMap(await normalizeProjects(result.data));
    changes.changedIds.forEach(function(id) {
      var base = changes.previous[id];
      var remoteProject = remote[id];
      if ((!base && remoteProject) || (base && (!remoteProject || !sameValue(base, remoteProject)))) {
        throw new Error('專案「' + id + '」已被其他同事修改。為避免覆蓋資料，這次存檔已取消；請重新整理後再編輯。');
      }
    });
  }

  async function persistProjects(projects) {
    var changes = getSaveChanges(projects);
    if (!changes.changedIds.length) return true;

    await checkForConflicts(changes);

    if (changes.upserts.length) {
      var cloudUpserts = await Promise.all(changes.upserts.map(async function(row) {
        return {
          id: row.id,
          name: row.name,
          plant: row.plant,
          owner: row.owner,
          project_data: await compressProject(row.project_data),
          updated_at: row.updated_at
        };
      }));
      var upsertResult = await getClient().from('projects').upsert(cloudUpserts, { onConflict: 'id' });
      if (upsertResult.error) {
        console.error('Supabase project save failed:', upsertResult.error);
        throw new Error('專案雲端存檔失敗：' + upsertResult.error.message);
      }
      recordSyncedChanges(changes.upserts);
    }

    if (changes.deletions.length) {
      var deleteResult = await getClient().from('projects').delete().in('id', changes.deletions);
      if (deleteResult.error) {
        console.error('Supabase project delete failed:', deleteResult.error);
        throw new Error('雲端刪除專案失敗：' + deleteResult.error.message);
      }
      recordSyncedChanges([], changes.deletions);
    }

    return true;
  }

  function save(db, notifyFn) {
    if (!db || !Array.isArray(db.projects)) {
      var invalidDbError = new Error('無法保存：專案資料格式不正確。');
      console.error(invalidDbError.message);
      if (notifyFn) notifyFn(invalidDbError.message);
      return Promise.resolve(false);
    }

    var projects = clone(db.projects);
    var task = saveQueue.then(function() {
      return persistProjects(projects);
    }).catch(function(error) {
      console.error('Supabase save failed:', error);
      if (notifyFn) notifyFn(error.message);
      return false;
    });
    saveQueue = task.then(function() {}, function() {});
    return task;
  }

  async function refreshProjects() {
    return loadProjectsFromSupabase();
  }

  function acceptRemoteProjects(projects) {
    syncedProjects = clone(projects || []);
  }

  function hasLocalChanges(db) {
    return !!(db && !sameProjects(db.projects, syncedProjects));
  }

  function getMigrationNotice() {
    var notice = migrationNotice;
    migrationNotice = '';
    return notice;
  }

  function storageUsageKb(db) {
    try {
      var data = JSON.stringify(db && db.projects || []);
      return Math.round(data.length * 2 / 1024);
    } catch (error) {
      console.error('Failed to estimate project data size:', error);
      return 0;
    }
  }

  function exportData(db) {
    if (!db) return '';
    try {
      return JSON.stringify(db, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      return '';
    }
  }

  function importData(jsonStr) {
    if (!jsonStr) return null;
    try {
      var data = JSON.parse(jsonStr);
      if (!data || typeof data !== 'object') throw new Error('Invalid data format');
      return migrateDb(data);
    } catch (error) {
      console.error('Failed to import data:', error);
      return null;
    }
  }

  function clear() {
    try {
      window.localStorage.removeItem(C.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear local migration data:', error);
    }
  }

  async function initialize() {
    var cloudProjects = await loadProjectsFromSupabase();
    syncedProjects = clone(cloudProjects);
    var db = {
      schemaVersion: C.SCHEMA_VERSION,
      version: 1,
      projects: cloudProjects,
      notices: [],
      auditLogs: [],
      today: new Date().toISOString().slice(0, 10),
      seq: 1
    };

    var legacyDb = readLegacyDb();
    if (legacyDb && legacyDb.seeded) db.seeded = true;
    if (legacyDb && legacyDb.projects && legacyDb.projects.length && !cloudProjects.length) {
      db.projects = legacyDb.projects;
      db.seq = legacyDb.seq || 1;
      var migrated = await save(db);
      if (!migrated) throw new Error('本機專案遷移至雲端失敗；本機資料已保留，請檢查 Supabase 權限後重試。');
      removeLegacyDb();
      migrationNotice = '已將 ' + db.projects.length + ' 個本機專案遷移至雲端。通知與操作紀錄不在本次遷移範圍。';
    } else if (legacyDb && legacyDb.projects && legacyDb.projects.length && cloudProjects.length) {
      migrationNotice = '雲端已有專案；為避免覆蓋或重複，本機專案未自動遷移，且已保留本機舊資料。';
    }

    if (!db.projects.length) db.seq = 1;
    else {
      var highestSequence = db.projects.reduce(function(highest, project) {
        var match = /^P(\d+)/.exec(project.id || '');
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);
      db.seq = Math.max(Number(db.seq) || 1, highestSequence + 1);
    }

    if (State.setDb) State.setDb(db);
    return db;
  }

  function createProjectId(sequence) {
    var randomPart;
    if (window.crypto && window.crypto.randomUUID) randomPart = window.crypto.randomUUID().slice(0, 8);
    else randomPart = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return 'P' + String(sequence).padStart(3, '0') + '-' + randomPart;
  }

  window.StorageAPI = {
    load: loadProjectsFromSupabase,
    loadProjectsFromSupabase: loadProjectsFromSupabase,
    refreshProjects: refreshProjects,
    acceptRemoteProjects: acceptRemoteProjects,
    hasLocalChanges: hasLocalChanges,
    getMigrationNotice: getMigrationNotice,
    createProjectId: createProjectId,
    save: save,
    migrate: migrateDb,
    export: exportData,
    import: importData,
    clear: clear,
    storageUsageKb: storageUsageKb,
    initialize: initialize
  };

})(typeof window !== 'undefined' ? window : globalThis);
