import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Trees, Inbox, Images, BellRing, BellOff, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'

export default function Layout() {
  const { logout, user } = useAuth()
  const { neuCount, pushPermission, enablePush } = useNotifications()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container app-header-inner">
          <NavLink to="/" className="brand" aria-label="Startseite">
            <span className="brand-mark">
              <Trees size={20} />
            </span>
            <span className="brand-text">
              <strong>Weiß Forst GbR</strong>
              <small>Adminbereich</small>
            </span>
          </NavLink>

          <nav className="app-nav" aria-label="Hauptnavigation">
            <NavLink to="/anfragen" className="nav-item">
              <Inbox size={18} />
              <span>Anfragen</span>
              {neuCount > 0 && <span className="nav-count">{neuCount}</span>}
            </NavLink>
            <NavLink to="/galerie" className="nav-item">
              <Images size={18} />
              <span>Galerie</span>
            </NavLink>
          </nav>

          <div className="header-actions">
            {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
              <button
                className="icon-btn"
                onClick={enablePush}
                title="Push-Benachrichtigungen aktivieren"
                aria-label="Push-Benachrichtigungen aktivieren"
              >
                <BellOff size={18} />
              </button>
            )}
            {pushPermission === 'granted' && (
              <span className="icon-btn is-on" title="Push aktiv" aria-label="Push aktiv">
                <BellRing size={18} />
              </span>
            )}
            <button
              className="icon-btn"
              onClick={handleLogout}
              title={`Abmelden (${user?.email || ''})`}
              aria-label="Abmelden"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
