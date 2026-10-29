import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isVerifiedUser } from '../lib/authErrors';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isVerifiedUser(user)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
