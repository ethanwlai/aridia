import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import RootPage from './pages/RootPage.jsx';
import './index.css';
import './pages/AuthPages.css';

const coarsePointerQuery = '(hover: none) and (pointer: coarse)';

function preventPinchZoom(event) {
  event.preventDefault();
}

function preventMultiTouchMove(event) {
  if (event.touches.length > 1) event.preventDefault();
}

function syncPinchGuard(matches) {
  if (matches) {
    document.addEventListener('gesturestart', preventPinchZoom, { passive: false });
    document.addEventListener('touchmove', preventMultiTouchMove, { passive: false });
    return;
  }
  document.removeEventListener('gesturestart', preventPinchZoom);
  document.removeEventListener('touchmove', preventMultiTouchMove);
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const coarsePointer = window.matchMedia(coarsePointerQuery);
  syncPinchGuard(coarsePointer.matches);
  coarsePointer.addEventListener('change', (event) => syncPinchGuard(event.matches));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/account"
            element={(
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
