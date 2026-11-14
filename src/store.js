const KEY = 'nesbit.island.v1';

const DEFAULTS = {
  name: 'Nesbit',
  githubUser: 'HRW233',
  model: null,
  hobbies: {},
  journal: [],
  studio: [],
  reading: [],
  planted: [],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULTS), ...parsed };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveState(state) {
  try {
    const trimmed = {
      ...state,
      reading: state.reading.slice(0, 24),
      journal: state.journal.slice(0, 80),
      studio: state.studio.slice(0, 18),
      planted: state.planted.slice(0, 24),
    };
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* storage can be full or blocked; the island still works */
  }
}

export function resetState() {
  localStorage.removeItem(KEY);
}
