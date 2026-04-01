import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Questr",
  description: "Privacy Policy for Questr",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>

      <h2>1. Overview</h2>
      <p>
        NEMETIX LTD ("we", "us", or "our") is committed to protecting your privacy. This policy explains how we collect,
        use, and safeguard your data in the Questr application. We operate under the <strong>UK GDPR</strong> and the
        Data Protection Act 2018.
      </p>

      <h2>2. Data We Collect</h2>
      <p>We process the following categories of personal data:</p>
      <ul>
        <li><strong>Identity & Contact:</strong> Email address, full name (optional), and age (to ensure you are over 13).</li>
        <li><strong>Usage Content:</strong> Goals you set, tasks you create, and messages you send to the "Oracle" chat.</li>
        <li><strong>Technical Data:</strong> IP address, browser type, timezone, and login frequency.</li>
        <li><strong>Billing Data:</strong> Transaction identifiers from Stripe (we do not store your credit card details;
          these are handled by the payment processor).</li>
      </ul>

      <h2>3. How We Use AI (LLMs)</h2>
      <p>
        Questr's core functionality relies on Large Language Models (LLMs) provided by third-party AI service providers.
      </p>
      <ul>
        <li><strong>Processing:</strong> When you create a quest or chat with the Oracle, your inputs and recent chat history
          are processed by these providers via secure API.</li>
        <li><strong>Anonymisation:</strong> We strive to exclude direct identifiers (like your email) from the prompts sent
          to AI models.</li>
        <li><strong>No Training:</strong> Based on our enterprise API agreements, your data is <strong>not</strong> used by our
          AI providers to train their foundation models.</li>
      </ul>

      <h2>4. Data Retention & Deletion</h2>
      <p>
        We retain your data only for as long as your account is active.
      </p>
      <p>
        <strong>Complete Data Erasure:</strong> If you use the "Delete Account" feature in your settings, we trigger a
        comprehensive deletion process. This removes your profile, all your plans, tasks, chat history, and subscription links
        <strong>permanently</strong> from our systems. There is no "soft-delete"; once deleted, this data cannot be recovered.
      </p>

      <h2>5. Sharing Your Information</h2>
      <p>We share data only with essential service providers:</p>
      <ul>
        <li><strong>Supabase:</strong> For database hosting, authentication, and file storage.</li>
        <li><strong>Stripe:</strong> For payment processing and subscription management.</li>
        <li><strong>AI Providers:</strong> Third-party industry leaders for processing AI-generated content.</li>
      </ul>
      <p>We never sell your personal data to third parties for marketing purposes.</p>

      <h2>6. Your Rights (UK GDPR)</h2>
      <p>You have the following rights regarding your data:</p>
      <ul>
        <li><strong>Access:</strong> The right to request a copy of the data we hold about you.</li>
        <li><strong>Rectification:</strong> The right to correct inaccurate data.</li>
        <li><strong>Erasure:</strong> The right to have your data deleted (simplified via our "Delete Account" button).</li>
        <li><strong>Portability:</strong> The right to receive your data in a structured, machine-readable format.</li>
        <li><strong>Withdraw Consent:</strong> Where you have given consent (e.g., for cookies), you have the right to withdraw it at any time.</li>
        <li><strong>Complaint:</strong> You have the right to lodge a complaint with the Information Commissioner's Office (ICO)
          if you believe we have not handled your data in accordance with the law. You can contact the ICO at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.</li>
      </ul>

      <h2>7. International Transfers</h2>
      <p>
        As a UK company, we primarily process data in the UK. However, some service providers (like Google) may process
        data in the US or other regions. We ensure appropriate safeguards (such as Standard Contractual Clauses) are in
        place for such transfers.
      </p>

      <h2>8. Contact Us</h2>
      <p>
        If you have any questions or wish to exercise your rights, please contact our Data Protection Officer:
        <br />
        NEMETIX LTD<br />
        122 Hawley Road, Dartford, England, DA1 1PA<br />
        <strong>Email: legal@questr.gg</strong>
      </p>
    </div>
  );
}