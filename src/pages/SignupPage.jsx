import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isVerifiedUser } from '../lib/authErrors';
import './AuthPages.css';

export default function SignupPage() {
  const { user, loading, configured, signUp, signInWithGoogle, resendConfirmation } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
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

  if (isVerifiedUser(user) && !submitting && !error) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setShowSignIn(false);
    setCanResend(false);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await signUp(email.trim(), password);
      const identities = data?.user?.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        setShowSignIn(true);
        setError('An account with this email already exists.');
        return;
      }
      if (data?.user?.confirmation_sent_at) {
        setCanResend(true);
        setInfo('Confirm your email to sign in.');
        return;
      }
      setCanResend(true);
      setError('Verification email was not sent. Check the Supabase Auth logs and SMTP settings, then try again.');
    } catch (err) {
      setError(err.message || 'Could not create an account.');
      setShowSignIn(err.code === 'email_exists' || err.code === 'user_already_exists');
      setCanResend(err.code === 'email_address_not_authorized' || err.code === 'over_email_send_rate_limit');
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
        <h1>Create account</h1>
        <p className="auth-lead">Local tasks and events on this device will be saved to your new account.</p>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <label className="auth-label">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </label>
          {error && (
            <p className="auth-error">
              {error}
              {showSignIn && <> <Link to="/login">Sign in</Link></>}
            </p>
          )}
          {info && <p className="auth-muted">{info}</p>}
          {canResend && (
            <button className="auth-secondary" type="button" onClick={handleResend} disabled={resending || submitting || !email.trim()}>
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          )}
          <button className="auth-primary" type="submit" disabled={submitting || !configured}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="auth-divider">or</div>
        <button className="auth-google" type="button" onClick={handleGoogle} disabled={submitting || !configured}>
          Continue with Google
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <Link className="auth-back" to="/">Back</Link>
      </div>
    </div>
  );
}
