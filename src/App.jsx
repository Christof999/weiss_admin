import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Toasts from './components/Toasts'
import NewRequestPopup from './components/NewRequestPopup'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Anfragen from './pages/Anfragen'
import AnfrageDetail from './pages/AnfrageDetail'
import Galerie from './pages/Galerie'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/anfragen" element={<Anfragen />} />
              <Route path="/anfragen/:id" element={<AnfrageDetail />} />
              <Route path="/galerie" element={<Galerie />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* App-weite Overlays */}
          <Toasts />
          <NewRequestPopup />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
