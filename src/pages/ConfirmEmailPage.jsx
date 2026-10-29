import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { authErrorMessage, isVerifiedUser, toAuthError } from '../lib/authErrors';
import './AuthPages.css';

const OTP_TYPES = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']);
const otpVerifications = new Map();

function readConfirmParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const type = query.get('type') || 'signup';
  return {
    errorCode: hash.get('error_code') || query.get('error_code') || '',
    errorDescription: hash.get('error_description') || query.get('error_description') || '',
    tokenHash: query.get('token_hash') || '',
    type: OTP_TYPES.has(type) ? type : 'signup',
  };
}

function verifySignupOtp(tokenHash, type) {
  const key = `${type}:${tokenHash}`;
  if (!otpVerifications.has(key)) {
    otpVerifications.set(
      key,
      supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ data, error }) => {
        if (error) throw toAuthError(error, 'Could not confirm this email.');
        const confirmed = data?.user?.email_confirmed_at || data?.session?.user?.email_confirmed_at;
        if (!confirmed) {
          const unconfirmed = new Error('Confirm your email to sign in.');
          unconfirmed.code = 'email_not_confirmed';
          throw unconfirmed;
        }
        return data;
      }),
    );
  }
  return otpVerifications.get(key);
}

export default function ConfirmEmailPage() {
  const { user, loading, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const [params] = useState(readConfirmParams);
  const [error, setError] = useState(() => (
    params.errorCode || params.errorDescription
      ? authErrorMessage(
        { code: params.errorCode, message: params.errorDescription },
        'This confirmation link is invalid. Resend the verification email and try again.',
      )
      : ''
  ));
  const [info, setInfo] = useState('');
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState(params.errorCode || params.errorDescription ? 'error' : 'working');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!params.tokenHash) return undefined;
    if (!supabase) {
      setError('Authentication is not configured.');
      setPhase('error');
      return undefined;
    }
    let cancelled = false;
    verifySignupOtp(params.tokenHash, params.type)
      .then(() => {
        if (!cancelled) setPhase('confirmed');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not confirm this email.');
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [params.tokenHash, params.type]);

  useEffect(() => {
    if (loading || phase === 'error') return;
    if (isVerifiedUser(user)) {
      navigate('/', { replace: true });
      return;
    }
    if (params.tokenHash || params.errorCode || params.errorDescription) return;
    if (!user) {
      setError('This confirmation link is invalid. Resend the verification email and try again.');
      setPhase('error');
    }
  }, [loading, user, phase, params.tokenHash, params.errorCode, params.errorDescription, navigate]);

  const handleResend = async (event) => {
    event.preventDefault();
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

  const showResend = phase === 'error';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Confirm email</h1>
        {phase === 'working' && <p className="auth-muted">Confirming your email…</p>}
        {phase === 'confirmed' && <p className="auth-muted">Email confirmed. Signing you in…</p>}
        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-muted">{info}</p>}
        {showResend && (
          <form className="auth-form" onSubmit={handleResend}>
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
            <button className="auth-secondary" type="submit" disabled={resending || !email.trim()}>
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          </form>
        )}
        <p className="auth-switch">
          <Link to="/login">Sign in</Link>
        </p>
        <Link className="auth-back" to="/">Back</Link>
      </div>
    </div>
  );
}
