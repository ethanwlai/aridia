import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const provider = user?.app_metadata?.provider || user?.identities?.[0]?.provider || 'email';

  const handleSignOut = async () => {
    setError('');
    setSigningOut(true);
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign out.');
      setSigningOut(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Account</h1>
        <p className="auth-lead">Your tasks and events stay on this account and are hidden from other users.</p>
        <div className="auth-account-meta">
          <div>
            <span>Email</span>
            <strong>{user?.email || 'Signed in'}</strong>
          </div>
          <div>
            <span>Sign-in method</span>
            <strong>{provider === 'email' ? 'Email' : provider}</strong>
          </div>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-account-actions">
          <button className="auth-secondary" type="button" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Log out'}
          </button>
          <Link className="auth-back" to="/">Back to calendar</Link>
        </div>
      </div>
    </div>
  );
}
