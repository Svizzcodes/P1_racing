export function getNumber(key, fallback = 0) {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  const v = window.localStorage.getItem(key);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function setNumber(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(key, String(Number(value)));
}

export function getString(key, fallback = '') {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  const v = window.localStorage.getItem(key);
  return v === null ? fallback : v;
}

export function setString(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(key, String(value));
}

export function getJson(key, fallback) {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setJson(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}
