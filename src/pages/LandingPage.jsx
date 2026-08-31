import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import aridiaSphere from '../assets/aridia-sphere.png';
import aridiaWordmarkWhite from '../assets/aridia-wordmark-white.png';
import LandingDemo from '../components/LandingDemo';
import './LandingPage.css';

const HEADLINE = 'Keep your day in motion.';

function typeDelay(char) {
  let delay = 85 + Math.random() * 55;
  if (Math.random() < 0.22) delay += 45 + Math.random() * 95;
  if (Math.random() < 0.08) delay += 180 + Math.random() * 220;
  if (char === ' ') delay += 70 + Math.random() * 90;
  if (char && /[.,!?;:]/.test(char)) delay += 130 + Math.random() * 90;
  return delay;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function LandingPage({ onContinueAsGuest, onOpenCalendar }) {
  const [typed, setTyped] = useState('');
  const [showCaret, setShowCaret] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setTyped(HEADLINE);
      setShowCaret(false);
      return undefined;
    }

    let i = 0;
    let timer = 0;

    const typeNext = () => {
      i += 1;
      setTyped(HEADLINE.slice(0, i));
      if (i >= HEADLINE.length) return;
      timer = window.setTimeout(typeNext, typeDelay(HEADLINE[i - 1]));
    };

    timer = window.setTimeout(typeNext, typeDelay());

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="landing-page">
      <nav className="landing-nav">
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
            {onOpenCalendar ? 'Open calendar' : 'Continue as guest'}
          </button>
        </div>
      </nav>

      <main className="landing-hero">
        <div className="landing-copy">
          <div className="landing-brand">
            <div className="landing-brand-sphere-wrap">
              <img
                className="landing-brand-sphere"
                src={aridiaSphere}
                alt=""
                width={96}
                height={96}
              />
            </div>
            <img
              className="landing-brand-wordmark"
              src={aridiaWordmarkWhite}
              alt="Aridia"
              width={152}
              height={61}
            />
          </div>
          <h1 className="landing-headline" aria-label={HEADLINE}>
            <span className="landing-headline-sizer" aria-hidden="true">
              {HEADLINE}
              <span className="landing-headline-caret" />
            </span>
            <span className="landing-headline-typed" aria-hidden="true">
              {typed}
              {showCaret ? <span className="landing-headline-caret" /> : null}
            </span>
          </h1>
          <p className="landing-lead">
            Tasks that change with how you feel, so you can get more done.
          </p>
        </div>
        <LandingDemo />
      </main>
    </div>
  );
}
