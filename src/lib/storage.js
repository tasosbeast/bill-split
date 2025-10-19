const KEY = "bill-split@v1";

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// now saveState just writes what it's given
export function saveState(snapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    console.warn("Could not save state to localStorage");
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    console.warn("Could not clear state from localStorage");
  }
}
