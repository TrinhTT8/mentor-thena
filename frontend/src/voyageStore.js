import { DEMO_VOYAGES, QUEST_LIBRARY } from './teacherDemo.js'

// The teacher's voyages (which quests each class sails), remembered in THIS browser only.
// DEMO: there is no server route for assigning yet, so the teacher home and the Sea Map
// both read the list from here. v2 in the key: lists saved before the demo setup are ignored.
const STORAGE_KEY = 'mentorthena.teacher.voyages.v2'

export function loadVoyages() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved === 'object') return { ...DEMO_VOYAGES, ...saved }
  } catch {
    // private window or blocked storage: start from the demo voyages
  }
  return DEMO_VOYAGES
}

export function saveVoyages(voyages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(voyages))
  } catch {
    // ignore: the page still works, it just forgets on reload
  }
}

const questIds = new Set(QUEST_LIBRARY.map((q) => q.id))

// True when the class has at least one quest assigned.
export function hasQuests(voyages, classId) {
  return (voyages[classId] ?? []).some((id) => questIds.has(id))
}

// DEMO: after the FIRST quest is assigned, the Sea Map waits this long before showing
// the ships, as if the class were opening the quest. (Assigning more quests later
// does not restart the wait.)
export const SET_SAIL_DELAY_MS = 15_000
const SET_SAIL_KEY = 'mentorthena.teacher.setSailAt.v1'

function loadSetSail() {
  try {
    const saved = JSON.parse(localStorage.getItem(SET_SAIL_KEY) ?? 'null')
    if (saved && typeof saved === 'object') return saved
  } catch {
    // blocked storage: no wait is remembered
  }
  return {}
}

// Remember "this class set sail now" (call when its first quest is assigned).
export function markSetSail(classId) {
  try {
    localStorage.setItem(SET_SAIL_KEY, JSON.stringify({ ...loadSetSail(), [classId]: Date.now() }))
  } catch {
    // ignore: the ships just show right away
  }
}

// The class has a quest AND the 15-second wait is over. Classes with no saved
// time (like the demo classes that start with quests) are ready right away.
export function shipsReady(voyages, classId, now) {
  if (!hasQuests(voyages, classId)) return false
  const since = loadSetSail()[classId]
  return !since || now - since >= SET_SAIL_DELAY_MS
}
