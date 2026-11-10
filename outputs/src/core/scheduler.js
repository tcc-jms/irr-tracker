/**
 * src/core/scheduler.js
 * 定時任務排程系統
 */

(function(root) {
  'use strict';

  var tasks = [];
  var timers = {};

  function schedule(taskId, fn, interval) {
    tasks.push({ id: taskId, fn: fn, interval: interval });
    
    if (timers[taskId]) clearInterval(timers[taskId]);
    timers[taskId] = setInterval(function() {
      try {
        fn();
      } catch (e) {
        console.error('Task error:', taskId, e);
      }
    }, interval);
  }

  function current() {
    return tasks.slice();
  }

  function pendingCount() {
    return tasks.length;
  }

  function cancel(taskId) {
    if (timers[taskId]) {
      clearInterval(timers[taskId]);
      delete timers[taskId];
    }
    tasks = tasks.filter(function(t) { return t.id !== taskId; });
  }

  window.AppScheduler = {
    schedule: schedule,
    current: current,
    pendingCount: pendingCount,
    cancel: cancel
  };

})(typeof window !== 'undefined' ? window : globalThis);
