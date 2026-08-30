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
        <div className="landing-nav-end">
          <div className="landing-nav-actions">
            <Link className="landing-nav-signin" to="/login">Sign in</Link>
            <Link className="landing-nav-signup" to="/signup">Sign up</Link>
          </div>
          <button
            className="landing-guest"
            type="button"
            onClick={onOpenCalendar || onContinueAsGuest}
          >
            {onOpenCalendar ? 'Open calendar' : 'Continue as guest (local saves only)'}
          </button>
        </div>
      </nav>

      <main className="landing-hero">
        <div className="landing-copy">
          <h1>Keep your day in motion.</h1>
          <p className="landing-lead">
            Tasks that change with how you feel, so you can get more done.
          </p>
        </div>
        <LandingDemo />
      </main>
    </div>
  );
}
