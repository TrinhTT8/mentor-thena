import { Navigate, Route, Routes } from 'react-router-dom'
import StudentPage from './pages/StudentPage.jsx'
import TeacherPage from './pages/TeacherPage.jsx'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/student/:id" element={<StudentPage />} />
      <Route path="/teacher/:classId" element={<TeacherPage />} />
      <Route path="*" element={<Navigate to="/student/s1" replace />} />
    </Routes>
  )
}
