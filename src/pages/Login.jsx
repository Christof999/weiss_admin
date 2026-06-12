import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Trees, LogIn, Mail, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/utils'

export default function Login() {
  const { user, loading, login, isConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) {
    return (
      <div className="center-screen">
        <span className="spinner" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }
  if (user) {
    return <Navigate to={location.state?.from || '/'} replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card card" onSubmit={submit}>
        <div className="login-brand">
          <span className="brand-mark login-mark">
            <Trees size={26} />
          </span>
          <h1>Weiß Forst GbR</h1>
          <p className="muted">Adminbereich</p>
        </div>

        {!isConfigured && (
          <div className="alert alert-warn">
            Firebase ist nicht konfiguriert. Bitte <code>.env</code> ausfüllen (siehe SETUP.md).
          </div>
        )}

        <label className="field">
          <span className="label">E-Mail</span>
          <span className="input-icon">
            <Mail size={17} />
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@weiss-forst.de"
            />
          </span>
        </label>

        <label className="field">
          <span className="label">Passwort</span>
          <span className="input-icon">
            <Lock size={17} />
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </span>
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn btn-primary btn-block" disabled={busy || !isConfigured}>
          {busy ? <span className="spinner" /> : <LogIn size={18} />}
          Anmelden
        </button>
      </form>
    </div>
  )
}
