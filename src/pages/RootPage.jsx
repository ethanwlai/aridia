import { useCallback, useEffect, useState } from 'react';
import App from '../App';
import { useAuth } from '../context/AuthContext';
import { isVerifiedUser } from '../lib/authErrors';
import { isGuestSession, setGuestSession, SHOW_LANDING_EVENT } from '../lib/guest';
import LandingPage from './LandingPage';

export default function RootPage() {
  const { user, loading } = useAuth();
  const [guest, setGuest] = useState(isGuestSession);
  const [forceLanding, setForceLanding] = useState(false);

  useEffect(() => {
    const onShowLanding = () => {
      setGuest(false);
      setForceLanding(true);
    };
    window.addEventListener(SHOW_LANDING_EVENT, onShowLanding);
    return () => window.removeEventListener(SHOW_LANDING_EVENT, onShowLanding);
  }, []);

  const continueAsGuest = useCallback(() => {
    setGuestSession();
    setGuest(true);
    setForceLanding(false);
  }, []);

  const openCalendar = useCallback(() => {
    setForceLanding(false);
  }, []);

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!forceLanding && (isVerifiedUser(user) || guest)) {
    return <App />;
  }

  return (
    <LandingPage
      onContinueAsGuest={continueAsGuest}
      onOpenCalendar={isVerifiedUser(user) ? openCalendar : undefined}
    />
  );
}
