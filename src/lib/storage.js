const KEY = "bill-split@v1";

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Could not load state:", err);
    return null;
  }
}

export function saveState(partial) {
  try {
    const prev = loadState() || {};
    const next = { ...prev, ...partial };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("Could not save state to localStorage:", err);
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    console.warn("Could not clear state:", err);
  }
}
