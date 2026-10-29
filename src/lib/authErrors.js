const AUTH_ERROR_MESSAGES = {
  email_address_not_authorized:
    'Verification email was not sent. This project is still on Supabase\'s built-in mailer, which only emails organization members. Add a custom SMTP provider in the Supabase dashboard.',
  over_email_send_rate_limit:
    'Too many verification emails were sent. Wait a few minutes, then resend.',
  email_not_confirmed: 'Confirm your email to sign in.',
  otp_expired: 'This confirmation link has expired. Resend the verification email and try again.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
};

export function emailRedirectTo() {
  if (typeof window === 'undefined') return '/auth/confirm';
  return `${window.location.origin}/auth/confirm`;
}

export function authErrorMessage(error, fallback = 'Something went wrong.') {
  const code = error?.code || '';
  if (AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  return error?.message || fallback;
}

export function toAuthError(error, fallback) {
  const wrapped = new Error(authErrorMessage(error, fallback));
  wrapped.code = error?.code || '';
  wrapped.status = error?.status;
  return wrapped;
}

export function isVerifiedUser(user) {
  if (!user) return false;
  if (user.email_confirmed_at) return true;
  const provider = user.app_metadata?.provider || user.identities?.[0]?.provider;
  return Boolean(provider && provider !== 'email');
}
