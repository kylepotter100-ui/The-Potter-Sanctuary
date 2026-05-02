import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing use of The Potter Sanctuary website and the booking of treatments.",
};

const LAST_UPDATED = "2 May 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

      <p>
        These terms govern your use of The Potter Sanctuary website and the
        booking of treatments. By using our site or booking a treatment, you
        agree to these terms.
      </p>

      <h2>Who we are</h2>
      <p>
        The Potter Sanctuary is a sole-trader wellness studio based in Beck
        Row, Suffolk. Treatments are delivered by a fully trained Clarins
        therapist.
      </p>

      <h2>Bookings</h2>
      <p>
        Bookings can be made via our website. Once submitted, your request
        will be reviewed and confirmed by us via email. A booking is only
        finalised once you receive a confirmation email.
      </p>

      <h2>Consultation questionnaire</h2>
      <p>
        For your safety and to deliver the best treatment possible, we require
        a completed consultation questionnaire prior to your first session and
        any time your medical or health circumstances change.
      </p>
      <p>
        The questionnaire must be completed at least 12 hours before your
        appointment. Without a completed questionnaire, we reserve the right
        to postpone or refuse the treatment.
      </p>

      <h2>Payment</h2>
      <p>
        All treatments are paid for in cash directly after your session at the
        studio. We do not currently accept card or electronic payments. A
        treatment is considered complete upon payment.
      </p>

      <h2>Cancellation policy</h2>
      <p>
        We ask for at least 12 hours&apos; notice if you need to cancel or
        reschedule your appointment, as a courtesy to us and to allow other
        clients to book the slot.
      </p>
      <p>You can cancel your booking in three ways:</p>
      <ol>
        <li>
          Sign in to your account and use the &ldquo;Cancel booking&rdquo;
          button shown next to your upcoming sessions on the home page or in
          your account
        </li>
        <li>Reply to your booking confirmation email</li>
        <li>
          Contact us directly at{" "}
          <a href="mailto:hello@thepottersanctuary.co.uk">
            hello@thepottersanctuary.co.uk
          </a>
        </li>
      </ol>
      <p>
        Cancellations made less than 12 hours before the appointment, or
        non-attendance without notice, may impact your ability to book future
        treatments. Repeated late cancellations may result in declined
        bookings.
      </p>

      <h2>Lateness</h2>
      <p>
        If you arrive late, we will do our best to accommodate you, but the
        session may be shortened to keep our schedule on time. Full payment
        will still be required.
      </p>

      <h2>Health and safety</h2>
      <p>
        You are responsible for providing accurate, complete, and up-to-date
        health information via the consultation questionnaire. Some conditions
        may require GP consent or prevent certain treatments — your therapist
        will advise based on your responses.
      </p>
      <p>
        Massage and bodywork are intended for relaxation and wellness purposes
        only and are not a substitute for medical treatment.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        Treatments are provided on the basis of the information you supply.
        The Potter Sanctuary is not liable for adverse reactions arising from
        undisclosed conditions, allergies, or medications.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms from time to time. The latest version will
        always be available on this page.
      </p>

      <h2>Contact</h2>
      <p>
        For any questions about these terms, contact{" "}
        <a href="mailto:hello@thepottersanctuary.co.uk">
          hello@thepottersanctuary.co.uk
        </a>
        .
      </p>
    </>
  );
}
