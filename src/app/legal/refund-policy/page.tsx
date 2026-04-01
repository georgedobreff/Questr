import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy - Questr",
  description: "Refund and Cancellation Policy for Questr",
};

export default function RefundPolicyPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Refund & Cancellation Policy</h1>

      <h2>1. Subscription Cancellations</h2>
      <p>
        You may cancel your Questr Pro subscription at any time through your account billing settings.
      </p>
      <ul>
        <li><strong>Immediate Termination:</strong> As stated in our Terms of Service, upon cancellation, your access to
          Pro features will be terminated <strong>immediately</strong>.</li>
        <li><strong>No Future Charges:</strong> Once cancelled, you will not be charged for the next billing cycle.</li>
        <li><strong>No Refunds for Partial Periods:</strong> We do not provide refunds or credits for any partial subscription
          periods or for accidental renewals where you failed to cancel before the renewal date.</li>
      </ul>

      <h2>2. Refund Policy</h2>
      <p>
        Due to the digital nature of our Service (immediate delivery of AI-generated content and quest plans),
        we generally do not offer refunds once the Service has been accessed.
      </p>

      <h3>14-Day Statutory "Cooling-Off" Period (UK/EU)</h3>
      <p>
        Under the UK Consumer Contracts Regulations, you normally have a 14-day period to change your mind. However:
      </p>
      <ul>
        <li>By accessing the Pro features (e.g., generating a quest plan or sending a message to the Oracle),
          you expressly request immediate performance of the contract.</li>
        <li>You acknowledge that by accessing the Service, you waive your statutory right to a 14-day refund
          for "change of mind."</li>
      </ul>

      <h3>Faulty Digital Content</h3>
      <p>
        Under the Consumer Rights Act 2015, if our Service is faulty, not fit for purpose, or not as described,
        you have the right to a repair or replacement.
      </p>
      <ul>
        <li>If we cannot fix a technical fault within a reasonable timeframe, you may be entitled to a partial or full refund.</li>
        <li><strong>Please Note:</strong> "Hallucinations" or inaccuracies in AI-generated content (as described in our
          Terms of Service) do not constitute a technical fault, as this is the inherent nature of Large Language Models.</li>
      </ul>

      <h2>3. Plan Credits</h2>
      <p>
        One-time purchases of "Plan Credits" are considered consumed the moment they are used to generate a quest.
        Unused credits may be eligible for a refund within 14 days of purchase, provided no credits from that
        transaction have been spent.
      </p>

      <h2>4. How to Request a Refund</h2>
      <p>
        If you believe you are entitled to a refund due to a technical fault, please contact our support team at:
        <br />
        <strong>legal@questr.gg</strong>
        <br />
        Please include your account email and a description of the technical issue.
      </p>

      <h2>5. Dispute Resolution</h2>
      <p>
        This policy is governed by the laws of England and Wales.
      </p>
    </div>
  );
}
