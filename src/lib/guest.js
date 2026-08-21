export const GUEST_FLAG_KEY = 'aridia-guest';

export function isGuestSession() {
  try {
    return sessionStorage.getItem(GUEST_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGuestSession() {
  sessionStorage.setItem(GUEST_FLAG_KEY, '1');
}

export function clearGuestSession() {
  try {
    sessionStorage.removeItem(GUEST_FLAG_KEY);
  } catch {
    // ignore
  }
}

export const SHOW_LANDING_EVENT = 'aridia-show-landing';

export function requestShowLanding() {
  clearGuestSession();
  window.dispatchEvent(new Event(SHOW_LANDING_EVENT));
}
