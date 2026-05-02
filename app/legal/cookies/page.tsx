import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookies Policy",
  description:
    "How The Potter Sanctuary uses cookies on its website and how you can manage them.",
};

const LAST_UPDATED = "2 May 2026";

export default function CookiesPage() {
  return (
    <>
      <h1>Cookies Policy</h1>
      <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

      <p>
        This policy explains what cookies are, how we use them, and how you
        can manage them.
      </p>

      <h2>What are cookies?</h2>
      <p>
        Cookies are small text files placed on your device when you visit a
        website. They help websites function correctly, remember your
        preferences, and provide a better experience.
      </p>

      <h2>Cookies we use</h2>

      <h3>Essential cookies (always active)</h3>
      <p>
        These cookies are necessary for the website to function and cannot be
        switched off. They include:
      </p>
      <ul>
        <li>Authentication cookies — to keep you signed in to your account</li>
        <li>Session cookies — to maintain your booking session</li>
        <li>Security cookies — to prevent fraudulent activity</li>
      </ul>
      <p>
        These cookies do not store any personally identifiable information
        beyond what&apos;s needed for these functions.
      </p>

      <h2>Third-party services</h2>
      <ul>
        <li>
          Supabase: provides authentication and stores cookies necessary for
          sign-in
        </li>
        <li>
          Cloudflare: provides hosting and security; may set cookies for
          performance and security
        </li>
      </ul>

      <h2>We do not use</h2>
      <ul>
        <li>Advertising or tracking cookies</li>
        <li>Third-party analytics cookies (e.g. Google Analytics)</li>
        <li>Social media tracking cookies</li>
      </ul>

      <h2>Managing cookies</h2>
      <p>
        You can control cookies through your browser settings. Note that
        disabling essential cookies may prevent the booking system from
        functioning correctly.
      </p>
      <p>
        For more information about cookies, visit{" "}
        <a
          href="https://allaboutcookies.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          allaboutcookies.org
        </a>
        .
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The latest version will
        always be available on this page.
      </p>

      <h2>Contact</h2>
      <p>
        For any questions about cookies, contact{" "}
        <a href="mailto:hello@thepottersanctuary.co.uk">
          hello@thepottersanctuary.co.uk
        </a>
        .
      </p>
    </>
  );
}
