import type { AppState } from '../types';

const STORAGE_KEY = 'shieldsplit_state';

const defaultState: AppState = {
  groups: [],
  activeGroupId: null,
};

function isValidState(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.groups)) return false;
  return true;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return defaultState;
    return parsed;
  } catch {
    return defaultState;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function generateId(): string {
  return crypto.randomUUID();
}
