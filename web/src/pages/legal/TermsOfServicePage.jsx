import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

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

export default function TermsOfServicePage() {
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
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <FileText size={16} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Terms of Service</h1>
            <p className="text-xs text-gray-400 dark:text-white/30">Last updated: February 11, 2026</p>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <Section title="1. Acceptance of Terms">
          <p>By accessing or using the Apartment Bill Tracker application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>Apartment Bill Tracker is an application designed to help apartment residents and administrators manage shared utility bills, track payments, and split costs fairly among roommates. The app provides features including bill tracking, presence-based water billing, payment management, and billing cycle administration (&ldquo;the Service&rdquo;).</p>
        </Section>

        <Section title="3. User Accounts">
          <p>To use the Service, you must create an account by providing accurate and complete information including your name and email address. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.</p>
        </Section>

        <Section title="4. User Responsibilities">
          <Bullets items={[
            'Provide accurate billing and payment information',
            'Mark your presence/absence honestly for fair bill splitting',
            'Not attempt to manipulate billing calculations or payment records',
            'Not use the Service for any unlawful purpose',
            'Not interfere with or disrupt the Service or servers',
            'Keep your account credentials secure',
          ]} />
        </Section>

        <Section title="5. Administrator Responsibilities">
          <p>Room administrators are responsible for accurately entering utility bill amounts, managing billing cycles, verifying payments, and ensuring fair treatment of all room members. Administrators must not abuse their privileges to manipulate bills or payments.</p>
        </Section>

        <Section title="6. Billing & Payments">
          <p>The app facilitates tracking of shared bills and payments between roommates. Apartment Bill Tracker is not a payment processor — it tracks and records payments made through external methods (cash, bank transfer, GCash, etc.). We are not responsible for disputes between users regarding payments made outside the app.</p>
        </Section>

        <Section title="7. Data Accuracy">
          <p>While we strive for accuracy in bill calculations and splitting, users should verify all amounts before making payments. We use penny-accurate math to ensure fair splitting, but the accuracy of results depends on the accuracy of data entered by administrators.</p>
        </Section>

        <Section title="8. Intellectual Property">
          <p>The Service, including its design, features, and content, is owned by the developer. You are granted a limited, non-exclusive, non-transferable license to use the application for its intended purpose.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to financial losses from incorrect bill calculations or payment disputes.</p>
        </Section>

        <Section title="10. Termination">
          <p>We reserve the right to suspend or terminate your account at any time for violation of these terms. You may delete your account at any time by contacting an administrator. Upon termination, your access to the Service will cease immediately.</p>
        </Section>

        <Section title="11. Changes to Terms">
          <p>We may update these Terms of Service from time to time. Continued use of the Service after changes constitutes acceptance of the modified terms. We will notify users of significant changes through the app.</p>
        </Section>

        <Section title="12. Contact">
          <p>If you have questions about these Terms of Service, please contact the app administrator or developer through the in-app Support page.</p>
        </Section>
      </div>
    </div>
  );
}
