import { Link } from 'react-router-dom';
import aridiaLogoWhite from '../assets/aridia-logo-white.png';
import LandingDemo from '../components/LandingDemo';
import './LandingPage.css';

export default function LandingPage({ onContinueAsGuest, onOpenCalendar }) {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <img
          className="landing-nav-logo"
          src={aridiaLogoWhite}
          alt="Aridia"
          width={91}
          height={44}
        />
        <div className="landing-nav-actions">
          <Link className="landing-nav-signin" to="/login">Sign in</Link>
          <Link className="landing-nav-signup" to="/signup">Sign up</Link>
        </div>
      </nav>

      <main className="landing-hero">
        <div className="landing-copy">
          <h1>Keep your day in motion.</h1>
          <p className="landing-lead">
            A calendar that plans with your energy — tasks and events, sorted by how motivated you feel.
          </p>
          <div className="landing-actions">
            <Link className="landing-btn landing-btn-primary" to="/signup">Sign up</Link>
            <Link className="landing-btn landing-btn-secondary" to="/login">Sign in</Link>
          </div>
          <p className="landing-cloud-note">Sign up or sign in to save onto the cloud.</p>
          <button
            className="landing-guest"
            type="button"
            onClick={onOpenCalendar || onContinueAsGuest}
          >
            {onOpenCalendar ? 'Open calendar' : 'Continue as guest (local saves only)'}
          </button>
        </div>
        <LandingDemo />
      </main>
    </div>
  );
}
