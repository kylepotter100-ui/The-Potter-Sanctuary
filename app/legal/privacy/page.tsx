import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How The Potter Sanctuary collects, uses, and safeguards your personal information.",
};

const LAST_UPDATED = "2 May 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

      <p>
        The Potter Sanctuary (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
        is committed to protecting your privacy. This policy explains how we
        collect, use, and safeguard your personal information when you use our
        website thepottersanctuary.co.uk.
      </p>

      <h2>Who we are</h2>
      <p>
        The Potter Sanctuary is a sole-trader wellness studio based in Beck Row,
        Suffolk, United Kingdom. For any privacy-related queries, contact{" "}
        <a href="mailto:hello@thepottersanctuary.co.uk">
          hello@thepottersanctuary.co.uk
        </a>
        .
      </p>

      <h2>Information we collect</h2>
      <p>
        When you book a treatment or create an account with us, we collect:
      </p>
      <ul>
        <li>
          Personal details: name, email address, phone number, date of birth,
          address, gender
        </li>
        <li>Emergency contact information</li>
        <li>
          Health information you provide via our consultation questionnaire
          (medical history, allergies, conditions, medications, treatment
          preferences)
        </li>
        <li>Booking history and consultation responses</li>
        <li>
          Technical information when you visit our site (IP address, browser
          type, pages visited)
        </li>
      </ul>

      <h2>How we use your information</h2>
      <p>We use your information solely to:</p>
      <ul>
        <li>Provide and manage your treatment bookings</li>
        <li>Tailor treatments safely to your individual circumstances</li>
        <li>Communicate with you about your appointments</li>
        <li>Send you reminders and confirmation emails</li>
        <li>
          Maintain accurate records as required by professional practice
          standards
        </li>
        <li>Improve our service</li>
      </ul>
      <p>We will never sell your information to third parties.</p>

      <h2>Legal basis</h2>
      <p>We process your information based on:</p>
      <ul>
        <li>
          <strong>Performance of a contract:</strong> managing your bookings
          and delivering treatments
        </li>
        <li>
          <strong>Legitimate interests:</strong> improving our service and
          maintaining professional records
        </li>
        <li>
          <strong>Consent:</strong> where you have explicitly agreed (e.g.
          marketing, if applicable)
        </li>
        <li>
          <strong>Legal obligation:</strong> where we are required to retain
          records
        </li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        We use the following trusted services to deliver our website and
        bookings:
      </p>
      <ul>
        <li>Supabase (database hosting, EU region)</li>
        <li>Cloudflare (website hosting and DNS)</li>
        <li>Resend (transactional email delivery)</li>
        <li>Google Workspace (business email)</li>
      </ul>
      <p>All providers are GDPR-compliant.</p>

      <h2>Data retention</h2>
      <p>
        We retain your booking and consultation records for seven (7) years
        from your last visit, in line with professional practice guidance for
        therapy and bodywork records. After this period, your data will be
        securely deleted.
      </p>

      <h2>Your rights</h2>
      <p>Under UK GDPR, you have the right to:</p>
      <ul>
        <li>Access your personal information</li>
        <li>Correct any inaccurate information</li>
        <li>
          Request deletion of your information (subject to retention
          requirements above)
        </li>
        <li>Object to certain types of processing</li>
        <li>Withdraw consent at any time</li>
        <li>
          Lodge a complaint with the Information Commissioner&apos;s Office
          (ICO)
        </li>
      </ul>
      <p>
        To exercise any of these rights, please contact{" "}
        <a href="mailto:hello@thepottersanctuary.co.uk">
          hello@thepottersanctuary.co.uk
        </a>
        .
      </p>

      <h2>Security</h2>
      <p>
        We take appropriate technical measures to protect your information,
        including encryption in transit (HTTPS), encryption at rest, magic-link
        authentication (no passwords stored), and access controls.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The latest version will
        always be available on this page.
      </p>
    </>
  );
}
