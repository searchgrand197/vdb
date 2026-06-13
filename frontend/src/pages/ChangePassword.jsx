import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import toast from 'react-hot-toast'
import {
  CorporateFare as CorporateFareIcon,
  Lock as LockIcon,
  Autorenew as AutorenewIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'
import { getApiErrorMessage } from '../utils/apiError'

function asMuiIcon(IconComponent) {
  return function IconBridge({ size, className, sx, ...rest }) {
    return <IconComponent className={className} sx={{ ...(size ? { fontSize: size } : {}), ...sx }} {...rest} />
  }
}

const Building2 = asMuiIcon(CorporateFareIcon)
const Lock = asMuiIcon(LockIcon)
const Loader2 = asMuiIcon(AutorenewIcon)
const ArrowBack = asMuiIcon(ArrowBackIcon)

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .cp * { font-family:'Inter',sans-serif; box-sizing:border-box; }

  .cp-bg {
    min-height:100vh;
    background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#312e81 100%);
    display:flex; align-items:center; justify-content:center; padding:0.5rem;
    position:relative; overflow:hidden;
  }
  .blob { position:absolute; border-radius:50%; filter:blur(80px); opacity:0.15; animation:bf 8s ease-in-out infinite; }
  .b1 { width:380px;height:380px;background:#3b82f6;top:-80px;left:-100px;animation-delay:0s; }
  .b2 { width:280px;height:280px;background:#8b5cf6;bottom:-60px;right:-60px;animation-delay:-3s; }
  @keyframes bf { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-20px) scale(1.04)} }

  .cp-card {
    background:rgba(255,255,255,0.97);
    border-radius:20px;
    box-shadow:0 24px 64px rgba(0,0,0,0.4);
    width:100%; max-width:420px;
    overflow:hidden; position:relative; z-index:1;
    animation:ci 0.45s cubic-bezier(0.22,1,0.36,1);
  }
  @keyframes ci { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }

  .cp-header {
    background:linear-gradient(135deg,#1d4ed8 0%,#4f46e5 55%,#7c3aed 100%);
    padding:14px 20px;
    display:flex; align-items:center; gap:12px;
    position:relative; overflow:hidden;
  }
  .cp-header::after {
    content:''; position:absolute; inset:0;
    background:radial-gradient(ellipse at 70% 0%,rgba(255,255,255,0.14) 0%,transparent 65%);
  }
  .cp-logo {
    width:40px; height:40px; border-radius:50%; flex-shrink:0;
    background:rgba(255,255,255,0.18); border:2px solid rgba(255,255,255,0.28);
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 4px 10px rgba(0,0,0,0.18); position:relative; z-index:1;
  }
  .cp-title { color:#fff; font-size:1.05rem; font-weight:800; margin:0; letter-spacing:-0.3px; position:relative; z-index:1; }
  .cp-sub   { color:rgba(196,213,255,0.85); font-size:0.68rem; margin:1px 0 0; font-weight:500; position:relative; z-index:1; }

  .cp-body { padding:14px 20px 10px; }

  .fl { display:block; font-size:0.62rem; font-weight:700; color:#94a3b8;
        text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px; }

  .fw { margin-bottom:9px; }
  .fi {
    width:100%; border:2px solid #e2e8f0; border-radius:10px;
    padding:9px 13px; font-size:0.85rem; color:#1e293b;
    outline:none; transition:border-color 0.16s,box-shadow 0.16s;
    background:#f8fafc; font-family:'Inter',sans-serif;
  }
  .fi:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.1); background:#fff; }
  .fi::placeholder { color:#94a3b8; }

  .sb {
    width:100%; padding:10px; border-radius:10px; border:none; margin-top:12px;
    background:linear-gradient(135deg,#2563eb 0%,#4f46e5 100%);
    color:#fff; font-size:0.88rem; font-weight:700;
    display:flex; align-items:center; justify-content:center; gap:7px;
    cursor:pointer; transition:all 0.18s ease;
    box-shadow:0 5px 14px rgba(37,99,235,0.3);
    font-family:'Inter',sans-serif;
  }
  .sb:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 20px rgba(37,99,235,0.4); }
  .sb:active:not(:disabled) { transform:translateY(0); }
  .sb:disabled { opacity:0.6; cursor:not-allowed; }

  .spin { animation:s360 0.8s linear infinite; }
  @keyframes s360 { to{transform:rotate(360deg)} }

  .cp-foot { padding:6px 20px 12px; text-align:center; }
  .cp-foot a { color:#3b82f6; text-decoration:none; font-weight:600; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; }
  .cp-foot p { color:#94a3b8; font-size:0.7rem; margin:0; }
`

export default function ChangePassword() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) {
      toast.error('Please enter your email address')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/change-password/', {
        email: normalizedEmail,
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      const msg =
        (typeof data?.message === 'string' && data.message.trim()) ||
        'Your password was updated successfully.'
      toast.success(msg)
      nav('/login', { replace: true })
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cp">
      <style>{STYLE}</style>
      <div className="cp-bg">
        <div className="blob b1" />
        <div className="blob b2" />

        <div className="cp-card">
          <div className="cp-header">
            <div className="cp-logo">
              <Lock size={22} color="#fff" />
            </div>
            <div>
              <div className="cp-title">Change password</div>
              <div className="cp-sub">Use the email you sign in with</div>
            </div>
          </div>

          <div className="cp-body">
            <form onSubmit={handleSubmit}>
              <div className="fw">
                <label className="fl">Email (username)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hospital.com"
                  className="fi"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="fw">
                <label className="fl">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Your existing password"
                  className="fi"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="fw">
                <label className="fl">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Choose a strong password"
                  className="fi"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="fw">
                <label className="fl">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="fi"
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" disabled={loading} className="sb">
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" /> Updating…
                  </>
                ) : (
                  <>
                    <Lock size={16} /> Update password
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="cp-foot">
            <Link to="/login">
              <ArrowBack size={14} /> Back to sign in
            </Link>
            <p style={{ marginTop: 8 }}>
              <Building2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              HMS Portal
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
