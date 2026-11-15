import { getStatus, getTask } from './api.js'

// Everything the student home page (the voyage map) needs, in one shape:
// {
//   studentName: "Alex" | null,           // first name only
//   className:   "Room 12" | null,
//   teacherName: "Ms. Lee" | null,
//   streak:      3 | null,                // days in a row
//   lessons: [ { task_id, title, instructions, skill?, example?,
//                status: "completed" | "current" | "locked" } ]   // in voyage order
// }
//
// TODAY the server only has GET /api/task (the ONE current task) and /api/status,
// so the voyage has a single island and the extra fields are null.
// When Person A adds a lessons route (proposed: GET /api/voyage/<student_id> returning
// this same shape), replace the body of loadVoyage() with one getJson call. Nothing
// else on the page needs to change.
export async function loadVoyage(studentId) {
  const [task, status] = await Promise.all([getTask(studentId), getStatus(studentId)])
  return {
    studentName: task.student_name ?? null,
    className: task.class_name ?? null,
    teacherName: task.teacher_name ?? null,
    streak: null,
    lessons: [
      {
        task_id: task.task_id,
        title: task.title,
        instructions: task.instructions,
        skill: task.skill ?? null,
        example: task.example ?? null,
        status: status.status === 'ithaca' ? 'completed' : 'current',
      },
    ],
  }
}

// Where each island sits on the map, in percent of the map's width and height.
// Islands zig-zag from left to right (low, high, low...) and Ithaca is always last,
// so 1 quest gives a short trip and 6 quests give a long winding route.
export function islandSpots(lessonCount) {
  const stops = lessonCount + 1 // + Ithaca
  const left = 12
  const right = 88
  return Array.from({ length: stops }, (_, i) => ({
    x: stops === 1 ? 50 : left + ((right - left) * i) / (stops - 1),
    y: i === stops - 1 ? 62 : i % 2 === 0 ? 66 : 34,
  }))
}
