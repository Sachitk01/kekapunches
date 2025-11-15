import axios from 'axios';
import { info, error } from './logger.js';
import { retryWithBackoff } from './retry.js';
import { incrementCounter } from './metrics.js';
import dotenv from 'dotenv';
dotenv.config();

const KEKA_API_BASE = process.env.KEKA_API_BASE;
const KEKA_API_TOKEN = process.env.KEKA_API_TOKEN || process.env.KEKA_API_KEY;

if (!KEKA_API_BASE) {
  error('KEKA_API_BASE not configured');
}
const axiosConfig = {
  baseURL: KEKA_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  timeout: 15000
};
if (KEKA_API_TOKEN) axiosConfig.headers.Authorization = `Bearer ${KEKA_API_TOKEN}`;
const apiClient = axios.create(axiosConfig);

export async function punchAttendance({ employeeId, type, timestamp, notes }) {
  if (!KEKA_API_BASE) throw new Error('KEKA_NOT_CONFIGURED');
  try {
    const payload = { employeeId, type, timestamp, source: 'SLACK-MW', notes: notes || '' };
    await retryWithBackoff(() => apiClient.post('/attendance/punch', payload));
    info('Keka punch', { employeeId, type, status: 200 });
    incrementCounter('keka_punch_total', 1);
    return payload;
  } catch (err) {
    error('Keka punch failed', { message: err.message, response: err.response?.data });
    incrementCounter('keka_punch_failures_total', 1);
    const e = new Error('KEKA_PUNCH_FAILED');
    e.cause = err;
    throw e;
  }
}

export async function findEmployeeByEmail(email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  let page = 1;
  const maxPages = 50;
  while (page <= maxPages) {
    try {
      const res = await retryWithBackoff(() =>
        apiClient.get('/hris/employees', {
          params: {
            'page[size]': 100,
            'page[number]': page,
            'fields[employees]': 'id,employee_number,personal'
          }
        })
      );
      const payload = res.data || {};
      const employees = Array.isArray(payload.data) ? payload.data : [];
      const meta = payload.meta || {};
      const currentPage = meta.page || meta.current_page || meta.current || page;
      const totalPages = meta.total_pages || meta.totalPages || meta.pages || 1;

      info('Keka page', { page: currentPage, count: employees.length });

      for (const emp of employees) {
        const personal = emp.personal || {};
        const candidates = [
          personal.work_email,
          personal.email,
          personal.official_email,
          personal.primary_email,
          emp.email,
          emp.work_email
        ].filter(Boolean).map(e => String(e).trim().toLowerCase());

        if (candidates.includes(target)) {
          const id = emp.id || emp.employee_id || emp.employee_number;
          if (!id) {
            error('Keka employee missing id', { emp });
            return null;
          }
          return { employeeId: id, employeeNumber: emp.employee_number, email: target, raw: emp };
        }
      }

      if (!totalPages || Number(currentPage) >= Number(totalPages)) break;
      page = Number(currentPage) + 1;
    } catch (err) {
      error('Keka lookup error', { page, message: err.message, response: err.response?.data });
      return null;
    }
  }
  return null;
}
