import { useMemo, useRef } from 'react'

// Watches how the student is typing so Argus can notice "idle" or "typing and deleting a lot".
// It only counts; it never changes what the kid does.

const TYPING_KEYS = new Set(['Enter', 'Tab'])
const DELETE_KEYS = new Set(['Backspace', 'Delete'])

// Plain JavaScript (no React), so the counting can be tested on its own.
// `now` is the clock; tests pass a fake one.
export function createActivityTracker(now = () => Date.now()) {
  let lastKeyAt = now()      // page open counts as the start: a kid who never types becomes idle
  let lastCursorAt = now()
  let typed = 0
  let deleted = 0

  return {
    // Call on every key press in the editor.
    key(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return // shortcuts like Ctrl+Enter aren't typing
      lastKeyAt = now()
      if (DELETE_KEYS.has(event.key)) deleted += 1
      else if (event.key.length === 1 || TYPING_KEYS.has(event.key)) typed += 1 // letters, digits, symbols, space
    },

    // Call when the editor's cursor or selection moves (clicks, arrow keys, typing).
    cursorMoved() {
      lastCursorAt = now()
    },

    // Read the numbers WITHOUT resetting them (for a debug display).
    peek() {
      const t = now()
      return {
        seconds_since_last_key: Math.floor((t - lastKeyAt) / 1000),
        seconds_since_cursor_move: Math.floor((t - lastCursorAt) / 1000),
        keys_typed: typed,
        keys_deleted: deleted,
      }
    },

    // Read the numbers for a heartbeat, then start counting keys again from zero,
    // so each heartbeat reports the keys pressed since the previous one.
    take() {
      const activity = this.peek()
      typed = 0
      deleted = 0
      return activity
    },
  }
}

// React wrapper: one tracker per page that survives re-renders.
//   const activity = useActivity()
//   <div onKeyDownCapture={activity.onKeyDown}>  <CodeMirror onUpdate={activity.onEditorUpdate} />
//   activity.take()  -> the `activity` object for a heartbeat
export function useActivity() {
  const trackerRef = useRef(null)
  if (trackerRef.current === null) trackerRef.current = createActivityTracker()
  const tracker = trackerRef.current

  // useMemo returns the SAME object on every render, so the heartbeat timer
  // that uses it is not restarted each time the kid types.
  return useMemo(() => ({
    onKeyDown: (event) => tracker.key(event),
    // CodeMirror calls onUpdate for every change; `selectionSet` is true when the cursor moved.
    onEditorUpdate: (viewUpdate) => {
      if (viewUpdate.selectionSet) tracker.cursorMoved()
    },
    peek: () => tracker.peek(),
    take: () => tracker.take(),
  }), [tracker])
}
