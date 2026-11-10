/**
 * src/core/notifications.js
 * 通知和提示系統
 */

(function(root) {
  'use strict';

  var Scheduler = window.AppScheduler || {};
  var Toast = window.AppToast || {};

  function addDays(iso, days) {
    var parts = iso.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + days);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function addYears(iso, years) {
    var parts = iso.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setFullYear(date.getFullYear() + years);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function scheduleProject(project, today) {
    var schedule = [];
    var reports = project.reports || {};
    var horizon = project.model && Number(project.model.horizon) || 0;
    for (var year = 1; year <= horizon; year++) {
      var periodStart = addYears(project.startDate, year - 1);
      var periodEnd = addDays(addYears(project.startDate, year), -1);
      var due = addDays(periodEnd, Number(project.graceDays) || 30);
      var status = reports[year] ? 'ok' : today > due ? 'late' : today > periodEnd ? 'due' : 'idle';
      schedule.push({ year: year, periodStart: periodStart, periodEnd: periodEnd, due: due, status: status, report: reports[year] || null });
    }
    return schedule;
  }

  function currentPeriod(project, today) {
    var schedule = scheduleProject(project, today);
    return schedule.filter(function(item) { return item.status === 'late'; })[0] ||
      schedule.filter(function(item) { return item.status === 'due'; })[0] ||
      schedule.filter(function(item) { return item.status === 'idle'; })[0] ||
      schedule[schedule.length - 1] || null;
  }

  function pendingCount(db, today) {
    var count = 0;
    (db && db.projects || []).forEach(function(project) {
      scheduleProject(project, today).forEach(function(item) {
        if (item.status === 'due' || item.status === 'late') count++;
      });
    });
    return count;
  }

  function runProjectSchedule(db, today) {
    if (!db) return 0;
    db.notices = db.notices || [];
    var sent = 0;
    (db.projects || []).forEach(function(project) {
      scheduleProject(project, today).forEach(function(item) {
        if (item.status !== 'due' && item.status !== 'late') return;
        var kind = item.status === 'due' ? 'remind' : 'overdue';
        var key = kind + '|' + project.id + '|' + item.year;
        if (db.notices.some(function(notice) { return notice.key === key; })) return;
        var name = project.name || project.meta && project.meta.name || project.id;
        var head = '專案：' + name + '\n廠區：' + (project.plant || '–') + '　負責人：' + (project.owner || '–') +
          '\n回報年度：第 ' + item.year + ' 年（' + item.periodStart + ' ～ ' + item.periodEnd + '）\n回報截止：' + item.due + '\n';
        db.notices.unshift({
          key: key,
          kind: kind,
          pid: project.id,
          year: item.year,
          to: project.contacts && project.contacts.plant || '（未設定）',
          subject: (item.status === 'due' ? '【待回報】' : '【逾期】') + name + ' 第' + item.year + '年實際效益',
          body: head + (item.status === 'due' ? '\n請回報實際效益。' : '\n已超過截止日，請儘速填寫。'),
          ch: ['Email'],
          at: today
        });
        sent++;
      });
    });
    return sent;
  }

  function notify(msg, type, duration) {
    if (type === undefined) type = 'info';
    if (duration === undefined) duration = 3000;
    
    if (Toast.show) {
      Toast.show(msg, duration);
    }
  }

  function runScheduler(db, today) {
    if (db) return runProjectSchedule(db, today || db.today || new Date().toISOString().slice(0, 10));
    var tasks = Scheduler.current ? Scheduler.current() : [];
    for (var i = 0; i < tasks.length; i++) {
      try {
        tasks[i].fn();
      } catch (e) {
        console.error('Scheduler task error:', e);
      }
    }
  }

  window.AppNotifications = {
    notify: notify,
    runScheduler: runScheduler,
    scheduleProject: scheduleProject,
    currentPeriod: currentPeriod,
    pendingCount: pendingCount
  };

})(typeof window !== 'undefined' ? window : globalThis);
