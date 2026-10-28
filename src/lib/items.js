import { supabase } from './supabase';
import { buildTestItems } from '../data/testItems';

export const TASKS_STORAGE_KEY = 'aridia-tasks';
export const PENDING_AUTH_KEY = 'aridia-pending-auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function newItemId() {
  return crypto.randomUUID();
}

function emptyToNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function toIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function loadLocalTasks() {
  const seed = buildTestItems();
  try {
    const saved = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!saved) return seed;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return seed;
    const have = new Set(parsed.map((item) => item.id));
    const missing = seed.filter((item) => !have.has(item.id));
    return missing.length ? [...parsed, ...missing] : parsed;
  } catch {
    return seed;
  }
}

/** Items actually written to this device. Does not include the unsaved demo seed. */
export function loadSavedLocalTasks() {
  try {
    const saved = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalTasks(tasks) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

export function clearLocalTasks() {
  localStorage.removeItem(TASKS_STORAGE_KEY);
}

export function consumePendingAuth() {
  try {
    const pending = sessionStorage.getItem(PENDING_AUTH_KEY);
    if (pending) sessionStorage.removeItem(PENDING_AUTH_KEY);
    return pending;
  } catch {
    return null;
  }
}

export function markPendingAuth(kind) {
  try {
    sessionStorage.setItem(PENDING_AUTH_KEY, kind);
  } catch {
    // ignore quota / private mode
  }
}

export function clearPendingAuth() {
  try {
    sessionStorage.removeItem(PENDING_AUTH_KEY);
  } catch {
    // ignore
  }
}

export function toRow(item, userId, { newId = false } = {}) {
  return {
    id: !newId && isUuid(item.id) ? item.id : newItemId(),
    user_id: userId,
    title: item.title || item.name || 'Untitled',
    description: emptyToNull(item.description),
    type: item.type === 'event' ? 'event' : 'task',
    status: item.status === 'completed' ? 'completed' : 'active',
    deadline: emptyToNull(item.deadline),
    end_deadline: emptyToNull(item.endDeadline),
    start_time: emptyToNull(item.startTime),
    end_time: emptyToNull(item.endTime),
    time: emptyToNull(item.time),
    energy: toIntOrNull(item.energy),
    priority: toIntOrNull(item.priority),
    duration: toIntOrNull(item.duration),
    task_type: item.taskType ?? null,
  };
}

export function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    name: row.title,
    description: row.description || '',
    type: row.type,
    status: row.status || 'active',
    deadline: row.deadline || '',
    endDeadline: row.end_deadline || null,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    time: row.time || '',
    energy: row.energy,
    priority: row.priority,
    duration: row.duration,
    taskType: row.task_type,
  };
}

export async function fetchCloudItems(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function insertCloudItem(item, userId) {
  if (!supabase) return item;
  const row = toRow(item, userId);
  const { data, error } = await supabase.from('items').insert(row).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateCloudItem(item, userId) {
  if (!supabase) return item;
  if (!isUuid(item.id)) {
    return insertCloudItem(item, userId);
  }
  const row = toRow(item, userId);
  const { data, error } = await supabase
    .from('items')
    .update(row)
    .eq('id', row.id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteCloudItem(itemId, userId) {
  if (!supabase || !userId) return;
  if (!isUuid(itemId)) return;
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function uploadLocalItems(items, userId) {
  const rows = items.map((item) => toRow(item, userId, { newId: true }));
  if (!supabase || !rows.length) return rows.map((row) => fromRow(row));
  const { data, error } = await supabase.from('items').insert(rows).select();
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function replaceCloudWithLocal(items, userId) {
  if (!supabase) return items;
  const { error: deleteError } = await supabase.from('items').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (!items.length) return [];
  return uploadLocalItems(items, userId);
}
