import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AccountMenu.css';

function accountAvatarUrl(user) {
  const meta = user?.user_metadata ?? {};
  if (meta.avatar_url) return meta.avatar_url;
  if (meta.picture) return meta.picture;
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const google = identities.find((identity) => identity.provider === 'google');
  const data = google?.identity_data ?? {};
  return data.avatar_url || data.picture || '';
}

export default function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  if (loading || !user) return null;

  const label = user.email || 'Account';
  const initial = (user.email || 'A').charAt(0).toUpperCase();
  const avatarUrl = accountAvatarUrl(user);

  const handleSignOut = async () => {
    setSignOutError('');
    try {
      await signOut();
      setOpen(false);
      navigate('/');
    } catch (err) {
      setSignOutError(err?.message || 'Could not sign out.');
      setOpen(true);
    }
  };

  return (
    <div className="account-menu" ref={wrapRef}>
      <button
        type="button"
        className="account-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        title={label}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{initial}</span>
        )}
      </button>
      {open && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-email">{label}</div>
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)}>Account</Link>
          <button type="button" role="menuitem" onClick={handleSignOut}>Log out</button>
          {signOutError && <p className="account-dropdown-error">{signOutError}</p>}
        </div>
      )}
    </div>
  );
}
