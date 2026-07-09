// Guarded localStorage (donor-repo pattern): if storage throws (private
// browsing, quota, policy), we flip to in-memory for the session instead of
// retrying — the app keeps working, it just won't survive a refresh.

let storageAvailable = true;

export const loadJson = <T>(key: string, fallback: T): T => {
  if (!storageAvailable) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const saveJson = (key: string, value: unknown): void => {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    storageAvailable = false;
  }
};
