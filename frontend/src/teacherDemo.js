// DEMO DATA for the teacher home page.
// The server has no routes yet for a teacher's classes, the quest library, or assigning
// quests. Only class "c1" is real: its live counts come from /api/seamap/c1 and
// "Open Sea Map" opens the real dashboard. Assigning here does NOT reach students yet.
// Replace this file when Person A adds the routes proposed in person-a-next.txt.

export const DEMO_CLASSES = [
  { id: 'c1', name: 'Room 12', students: 10, language: 'Python', code: 'ODY-42', live: true },
  { id: 'demo-room-8', name: 'Room 8', students: 12, language: 'Python', code: 'ODY-17', live: false },
  { id: 'demo-code-club', name: 'Code Club', students: 8, language: 'Python', code: 'ODY-08', live: false },
]

// The skills, in the order the library shows them.
export const SKILLS = ['Print', 'Variables', 'Loops', 'If statements', 'If / else', 'Debugging']

export const QUEST_LIBRARY = [
  { id: 'q-hello', title: 'Say hello to Ithaca', skill: 'Print', blurb: 'Use print to greet the island.' },
  { id: 'q-ship', title: 'Draw a ship with print', skill: 'Print', blurb: 'Print a few lines to build a ship picture.' },
  { id: 'q-aeolus', title: "Aeolus' bag of winds", skill: 'Variables', blurb: 'Store the wind in a variable and print it.' },
  { id: 'q-crew', title: 'Name your crew', skill: 'Variables', blurb: 'Save names in variables and say hello to each.' },
  { id: 'q-waves', title: 'Count the waves', skill: 'Loops', blurb: 'Use a for loop to say Splash! 3 times.' },
  { id: 'q-row', title: 'Row, row, row', skill: 'Loops', blurb: 'Use a while loop to row until you reach land.' },
  { id: 'q-cyclops', title: 'Escape the Cyclops', skill: 'If statements', blurb: 'Use if to check when the cave is open.' },
  { id: 'q-sirens', title: "Pass the Sirens' song", skill: 'If / else', blurb: 'Use if and else to choose: listen or plug your ears.' },
  { id: 'q-odd-even', title: 'Odd or even oars', skill: 'If / else', blurb: 'Use % with if and else to sort the oars.' },
  { id: 'q-oar', title: 'Fix the broken oar', skill: 'Debugging', blurb: 'Find and fix the bugs in a finished program.' },
]

// Each class's voyage at the start (quest ids, in the order students sail them).
export const DEMO_VOYAGES = {
  c1: ['q-hello', 'q-waves', 'q-aeolus', 'q-cyclops'],
  'demo-room-8': ['q-hello', 'q-crew'],
  'demo-code-club': ['q-oar'],
}
