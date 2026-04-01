import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Questr",
  description: "Terms of Service for Questr",
};

export default function TermsOfServicePage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Terms of Service</h1>

      <h2>1. Introduction</h2>
      <p>
        Welcome to Questr. These Terms of Service ("Terms") govern your access to and use of the Questr application and website (the "Service"),
        operated by <strong>NEMETIX LTD</strong> ("we," "us," or "our"), a company registered in England and Wales
        (Registration Number: 16915477), with its registered office at <strong>122 Hawley Road, Dartford, England, DA1 1PA</strong>.
      </p>
      <p>
        By creating an account or using our Service, you agree to be bound by these Terms and our Privacy Policy. If you are entering into these
        Terms on behalf of a company or other legal entity, you represent that you have the authority to bind such entity.
      </p>

      <h2>2. Account Registration and Security</h2>
      <p>
        To access most features of the Service, you must register for an account. You agree to provide accurate, current, and complete
        information. You are solely responsible for:
      </p>
      <ul>
        <li>Maintaining the confidentiality of your account credentials.</li>
        <li>All activities that occur under your account.</li>
        <li>Notifying us immediately of any unauthorized use of your account.</li>
      </ul>

      <h2>3. AI-Powered Features and Content</h2>
      <p>
        Questr utilizes Artificial Intelligence (AI) and Large Language Models (LLMs) to generate "Output" (including quest plans,
        character stories, and Oracle advice).
      </p>
      <ul>
        <li><strong>Nature of AI Output:</strong> You acknowledge that AI-generated content is probabilistic and can be inaccurate,
          incomplete, or biased. Output may occasionally "hallucinate" facts or provide advice that is not suitable for your specific context.</li>
        <li><strong>User Responsibility:</strong> You are responsible for reviewing and verifying the accuracy of any Output before
          relying on it. Questr is a productivity tool and is <strong>not</strong> a substitute for professional medical, legal,
          financial, or technical advice.</li>
        <li><strong>Intellectual Property:</strong> As between you and NEMETIX LTD, you own the specific goals and prompts you input.
          We grant you a license to use the Output generated for you for your personal, non-commercial productivity purposes.</li>
      </ul>

      <h2>4. Payments and Subscriptions</h2>
      <p>
        Our Service is billed through <strong>Stripe</strong>, who acts as our primary payment processor.
      </p>
      <ul>
        <li><strong>Subscriptions:</strong> "Pro" subscriptions grant access to enhanced features and higher usage quotas.
          These renew automatically until cancelled via your billing settings.</li>
        <li><strong>Plan Credits:</strong> We may offer one-time purchases of "Plan Credits" for generating additional quests.
          These are non-refundable once used.</li>
        <li><strong>Cancellations:</strong> You can cancel your subscription at any time. Please note that upon cancellation,
          you will <strong>immediately</strong> lose access to all Pro features, regardless of the time remaining in your
          billing period. No pro-rated refunds are provided for the remaining period.</li>
      </ul>

      <h2>5. Data Deletion and Account Termination</h2>
      <p>
        We believe in your right to own your data.
      </p>
      <ul>
        <li><strong>User-Initiated Deletion:</strong> You may delete your account at any time through the application settings.
          Executing the "Delete Account" function will result in the <strong>immediate, permanent, and irrecoverable deletion</strong>
          of your profile, goals, quest history, chat history, and all associated personal data from our active databases.</li>
        <li><strong>Termination by Us:</strong> We reserve the right to suspend or terminate your account if you violate these Terms
          or engage in activity that harms the Service or other users.</li>
      </ul>

      <h2>6. Prohibited Conduct</h2>
      <p>
        You agree not to:
      </p>
      <ul>
        <li>Use the AI features to generate harmful, illegal, or sexually explicit content.</li>
        <li>Attempt to reverse engineer or "jailbreak" the LLM prompts or Service infrastructure.</li>
        <li>Automate the Service (e.g., using bots or scrapers) without express permission.</li>
      </ul>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by the laws of England and Wales, NEMETIX LTD shall not be liable for any indirect,
        incidental, or consequential damages arising from your use of the Service or reliance on AI-generated Output. Our
        total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.
      </p>

      <h2>8. Governing Law</h2>
      <p>
        These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction
        of the courts of England and Wales.
      </p>

      <h2>9. Contact</h2>
      <p>
        For legal inquiries, please contact:
        <br />
        Legal Department, NEMETIX LTD<br />
        122 Hawley Road, Dartford, England, DA1 1PA<br />
        <strong>Email: legal@questr.gg</strong>
      </p>
    </div>
  );
}