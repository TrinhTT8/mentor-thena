import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import HomePage from './pages/HomePage.jsx'
import StudentPage from './pages/StudentPage.jsx'
import TeacherPage from './pages/TeacherPage.jsx'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/student/:id" element={<HomePage />} />
      <Route path="/student/:id/quest" element={<StudentPage />} />
      <Route path="/teacher/:classId" element={<TeacherPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
