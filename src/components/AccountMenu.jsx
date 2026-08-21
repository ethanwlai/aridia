import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AccountMenu.css';

export default function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/');
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
        {user.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url} alt="" />
        ) : (
          <span>{initial}</span>
        )}
      </button>
      {open && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-email">{label}</div>
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)}>Account</Link>
          <button type="button" role="menuitem" onClick={handleSignOut}>Log out</button>
        </div>
      )}
    </div>
  );
}
