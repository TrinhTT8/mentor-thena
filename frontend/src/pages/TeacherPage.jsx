import { useParams } from 'react-router-dom'
import HealthCheck from '../components/HealthCheck.jsx'

// Placeholder: Sea Map and Tiresias tip come later.
export default function TeacherPage() {
  const { classId } = useParams()

  return (
    <main>
      <h1>Sea Map for class {classId}</h1>
      <HealthCheck />
    </main>
  )
}
