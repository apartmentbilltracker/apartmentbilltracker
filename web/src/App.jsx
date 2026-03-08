import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import { Spinner } from './components/ui';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Client pages
import ClientHomePage from './pages/client/ClientHomePage';
import BillsPage from './pages/client/BillsPage';
import BillingHistoryPage from './pages/client/BillingHistoryPage';
import AnnouncementsPage from './pages/client/AnnouncementsPage';
import PresencePage from './pages/client/PresencePage';
import ProfilePage from './pages/client/ProfilePage';
import NotificationsPage from './pages/client/NotificationsPage';
import SupportPage from './pages/client/SupportPage';
import RoomDetailsPage from './pages/client/RoomDetailsPage';
import SettlementPage from './pages/client/SettlementPage';

// Payment pages
import PaymentHistoryPage from './pages/payments/PaymentHistoryPage';

// Legal pages
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage';
import TermsOfServicePage from './pages/legal/TermsOfServicePage';

function ProtectedRoute({ children }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  if (!state.token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function AuthRoute({ children }) {
  const { state } = useAuth();

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  if (state.token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />
      <Route path="/forgot-password" element={<AuthRoute><ForgotPasswordPage /></AuthRoute>} />

      {/* Protected app routes (wrapped in layout) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientHomePage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="billing-history" element={<BillingHistoryPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="presence" element={<PresencePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="room-details" element={<RoomDetailsPage />} />
        <Route path="room/:id" element={<RoomDetailsPage />} />
        <Route path="settlements" element={<SettlementPage />} />

        {/* Payment routes */}
        <Route path="payment-history" element={<PaymentHistoryPage />} />
        <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="terms-of-service" element={<TermsOfServicePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
