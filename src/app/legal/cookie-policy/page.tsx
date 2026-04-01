import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy - Questr",
  description: "Cookie Policy for Questr",
};

export default function CookiePolicyPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Cookie Policy</h1>

      <h2>1. What are Cookies?</h2>
      <p>
        Cookies and local storage are small data files stored on your device that help us provide a functional and
        personalized experience.
      </p>

      <h2>2. How We Use Them</h2>
      <p>Questr uses the following types of storage:</p>

      <h3>A. Strictly Necessary (Essential)</h3>
      <p>
        These are required for the app to function. You cannot opt out of these if you wish to use the Service.
      </p>
      <ul>
        <li><strong>Authentication:</strong> We use Supabase Auth to keep you logged in (`sb-access-token` and `sb-refresh-token`).</li>
        <li><strong>Security:</strong> To protect against cross-site request forgery and other security threats.</li>
      </ul>

      <h3>B. Preference Storage</h3>
      <p>
        These remember your choices to improve your experience.
      </p>
      <ul>
        <li><strong>Theme:</strong> We store your preference for interface appearance (Light or Dark mode).</li>
        <li><strong>Consent:</strong> We store whether you have accepted or declined this Cookie Policy so we don't ask you every time.</li>
      </ul>

      <h3>C. Analytics (Optional)</h3>
      <p>
        We may use tools to understand how you use the app (e.g., which features are most popular). We do not currently use
        third-party advertising cookies.
      </p>

      <h2>3. Managing Your Preferences</h2>
      <p>
        You can manage your cookies through our on-site banner or by adjusting your browser settings. Most browsers allow you to:
      </p>
      <ul>
        <li>See what cookies you've got and delete them on an individual basis.</li>
        <li>Block third-party cookies.</li>
        <li>Block cookies from particular sites.</li>
        <li>Block all cookies from being set.</li>
        <li>Delete all cookies when you close your browser.</li>
      </ul>

      <h2>4. Updates</h2>
      <p>
        We may update this policy from time to time to reflect changes in the technology or laws.
      </p>

      <h2>5. Contact</h2>
      <p>
        NEMETIX LTD<br />
        122 Hawley Road, Dartford, England, DA1 1PA<br />
        <strong>Email: legal@questr.gg</strong>
      </p>
    </div>
  );
}