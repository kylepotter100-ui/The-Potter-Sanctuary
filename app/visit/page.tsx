import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Visiting The Potter Sanctuary — Beck Row, Suffolk",
  description:
    "Plan your visit to The Potter Sanctuary in Beck Row, Suffolk — location, parking, what to expect, what to bring, and accessibility notes.",
  path: "/visit",
});

export default function VisitPage() {
  return (
    <>
      <Nav />
      <main className="info-page">
        <header className="info-page-header">
          <p className="info-eyebrow">The Potter Sanctuary</p>
          <h1>Visiting The Potter Sanctuary</h1>
          <p className="info-lede">
            A few notes to make your first visit easy.
          </p>
        </header>
        <div className="info-shell">
          <article className="info-card">
            <h2>Location</h2>
            <p>
              The Potter Sanctuary is located in Beck Row, Suffolk, near
              Mildenhall. The studio is a private space designed for calm and
              quiet — please ring the bell on arrival.
            </p>
            <p className="info-placeholder">
              Address: shared with you on booking.
            </p>
          </article>

          <article className="info-card">
            <h2>Parking</h2>
            <p>
              Free parking is available directly outside the studio. If
              parking is full, additional spaces are available a short walk
              away.
            </p>
          </article>

          <article className="info-card">
            <h2>What to expect</h2>
            <ul>
              <li>
                On arrival, you&apos;ll be welcomed into a calm, private
                space.
              </li>
              <li>
                Your therapist will discuss your consultation responses and
                any preferences before your treatment.
              </li>
              <li>
                Treatments take place in a quiet treatment room with soft
                lighting and warm towels.
              </li>
              <li>
                After your session, allow yourself a few moments to come back
                gently.
              </li>
            </ul>
          </article>

          <article className="info-card">
            <h2>What to bring</h2>
            <ul>
              <li>Just yourself — everything else is provided.</li>
              <li>
                Wear comfortable clothing that&apos;s easy to slip in and out
                of.
              </li>
              <li>Remove jewellery before your session.</li>
              <li>
                Cash payment after your treatment (we don&apos;t accept card).
              </li>
            </ul>
          </article>

          <article className="info-card">
            <h2>Accessibility</h2>
            <p>
              If you have any specific accessibility needs, please let us know
              in your booking notes or email{" "}
              <a href="mailto:hello@thepottersanctuary.co.uk">
                hello@thepottersanctuary.co.uk
              </a>
              .
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
