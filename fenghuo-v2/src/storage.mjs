// Independent keys keep v1 saves intact. Failures are reported, not thrown.
const PREFIX = 'fenghuo.v2.';
export const storage = {
  read(key, fallback) {
    try {
      const value = JSON.parse(globalThis.localStorage.getItem(PREFIX + key));
      if (value === null) return fallback;
      if (fallback && typeof fallback === 'object' && (typeof value !== 'object' || Array.isArray(value))) return fallback;
      return value;
    } catch { return fallback; }
  },
  write(key, value) {
    try { globalThis.localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
};
