import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isVerifiedUser } from '../lib/authErrors';
import './AuthPages.css';

export default function LoginPage() {
  const { user, loading, configured, signIn, signInWithGoogle, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (isVerifiedUser(user)) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setCanResend(false);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setCanResend(err.code === 'email_not_confirmed');
      setError(err.message || 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      await resendConfirmation(email.trim());
      setInfo('Confirm your email to sign in.');
    } catch (err) {
      setError(err.message || 'Could not resend the verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="auth-lead">Use your Aridia account or continue with Google.</p>
        {!configured && (
          <p className="auth-error">
            Authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.
          </p>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="auth-label">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-muted">{info}</p>}
          {canResend && (
            <button className="auth-secondary" type="button" onClick={handleResend} disabled={resending || submitting || !email.trim()}>
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          )}
          <button className="auth-primary" type="submit" disabled={submitting || !configured}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="auth-divider">or</div>
        <button className="auth-google" type="button" onClick={handleGoogle} disabled={submitting || !configured}>
          Continue with Google
        </button>
        <p className="auth-switch">
          Need an account? <Link to="/signup">Create one</Link>
        </p>
        <Link className="auth-back" to="/">Back</Link>
      </div>
    </div>
  );
}
