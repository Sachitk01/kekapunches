// lib/metrics.js - Prometheus metrics wrapper
let counters = {};

export function initMetrics() {
  counters = {
    keka_punch_total: 0,
    keka_punch_failures_total: 0,
    approvals_created_total: 0,
    approvals_approved_total: 0,
    approvals_rejected_total: 0
  };
}

export function incrementCounter(name, value = 1) {
  if (!counters[name]) counters[name] = 0;
  counters[name] += value;
}

export function getMetrics() {
  const lines = [];
  lines.push('# HELP keka_punch_total Total successful Keka punch operations');
  lines.push('# TYPE keka_punch_total counter');
  lines.push(`keka_punch_total ${counters.keka_punch_total || 0}`);
  lines.push('');
  lines.push('# HELP keka_punch_failures_total Total failed Keka punch operations');
  lines.push('# TYPE keka_punch_failures_total counter');
  lines.push(`keka_punch_failures_total ${counters.keka_punch_failures_total || 0}`);
  lines.push('');
  lines.push('# HELP approvals_created_total Total approvals created');
  lines.push('# TYPE approvals_created_total counter');
  lines.push(`approvals_created_total ${counters.approvals_created_total || 0}`);
  lines.push('');
  lines.push('# HELP approvals_approved_total Total approvals approved');
  lines.push('# TYPE approvals_approved_total counter');
  lines.push(`approvals_approved_total ${counters.approvals_approved_total || 0}`);
  lines.push('');
  lines.push('# HELP approvals_rejected_total Total approvals rejected');
  lines.push('# TYPE approvals_rejected_total counter');
  lines.push(`approvals_rejected_total ${counters.approvals_rejected_total || 0}`);
  lines.push('');
  return lines.join('\n');
}
