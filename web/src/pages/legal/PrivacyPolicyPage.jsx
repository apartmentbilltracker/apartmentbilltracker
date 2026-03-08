import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="space-y-2">
    <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
    <div className="text-sm text-gray-600 dark:text-white/60 space-y-2">{children}</div>
  </div>
);

const Bullets = ({ items }) => (
  <ul className="list-disc list-inside space-y-1 pl-2">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/profile"
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-500 dark:text-white/50" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Shield size={16} className="text-blue-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
            <p className="text-xs text-gray-400 dark:text-white/30">Last updated: February 11, 2026</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-white/50">
        Your privacy is important to us. This Privacy Policy explains how Apartment Bill Tracker collects, uses, and protects your personal information.
      </p>

      <div className="card p-6 space-y-6">
        <Section title="1. Information We Collect">
          <p className="font-medium text-gray-700 dark:text-white/80">Account Information</p>
          <Bullets items={[
            'Full name',
            'Email address',
            'Password (encrypted/hashed — we never store plain text)',
            'Profile avatar (optional)',
            'Authentication provider (email, Google, or Facebook)',
          ]} />
          <p className="font-medium text-gray-700 dark:text-white/80 pt-1">Usage Data</p>
          <Bullets items={[
            'Room membership and role (admin/member)',
            'Presence/absence records for bill splitting',
            'Payment records and transaction history',
            'Billing cycle data and charge adjustments',
          ]} />
          <p className="font-medium text-gray-700 dark:text-white/80 pt-1">Device Information</p>
          <Bullets items={[
            'Push notification tokens (for reminders)',
            'Device type (for app compatibility)',
          ]} />
        </Section>

        <Section title="2. How We Use Your Information">
          <Bullets items={[
            'Create and manage your account',
            'Calculate fair bill splits based on presence',
            'Track payments and billing cycles',
            'Send push notifications for billing reminders and updates',
            'Generate billing reports and payment summaries',
            'Verify your identity for account security',
            'Provide customer support through the ticket system',
          ]} />
        </Section>

        <Section title="3. Data Storage & Security">
          <p>Your data is stored securely using Supabase (cloud database) with row-level security policies. Passwords are hashed using bcrypt. Authentication tokens (JWT) are stored securely on your device using encrypted storage. We implement industry-standard security measures to protect your personal information.</p>
        </Section>

        <Section title="4. Data Sharing">
          <p>We do not sell, trade, or rent your personal data to third parties. Your information may be shared in the following limited circumstances:</p>
          <Bullets items={[
            'With your room administrator — to manage billing and verify payments',
            'With room members — only aggregated billing data (not your personal payment details)',
            'With Google/Facebook — only if you choose to sign in via OAuth (limited to authentication)',
            'As required by law — if legally compelled to disclose information',
          ]} />
        </Section>

        <Section title="5. Payment Privacy">
          <p>Each member can only view their own payment history and transaction details. Administrators can view payment status (paid/unpaid) for billing management purposes but individual payment method details are kept private.</p>
        </Section>

        <Section title="6. Third-Party Services">
          <p>The app integrates with the following third-party services:</p>
          <Bullets items={[
            'Supabase — database and data storage',
            'Google OAuth — optional sign-in method',
            'Facebook OAuth — optional sign-in method',
            'Expo Push Notifications — for billing reminders',
            'SMTP email service — for verification codes and password resets',
          ]} />
        </Section>

        <Section title="7. Data Retention">
          <p>Your account data is retained as long as your account is active. Billing history and payment records are kept for record-keeping purposes. If you request account deletion, your personal data will be removed, though anonymized billing records may be retained for the room's accounting integrity.</p>
        </Section>

        <Section title="8. Your Rights">
          <Bullets items={[
            'Access your personal data through your profile',
            'Update or correct your account information',
            'Request deletion of your account and personal data',
            'Opt out of non-essential push notifications',
            'Export your billing and payment history (PDF export)',
          ]} />
        </Section>

        <Section title="9. Children's Privacy">
          <p>The Service is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal data, please contact us.</p>
        </Section>

        <Section title="10. Cookies & Local Storage">
          <p>The web app uses browser local storage to save your authentication token and preferences. The mobile app uses AsyncStorage and SecureStore for the same purpose. No tracking cookies are used.</p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>We may update this Privacy Policy periodically. Changes will be communicated through the app. Your continued use of the Service after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="12. Contact Us">
          <p>For privacy-related questions or to exercise your data rights, please use the in-app Support page or contact the app administrator.</p>
        </Section>
      </div>
    </div>
  );
}
