import Link from "next/link";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { services } from "@/lib/services";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Our Treatments — The Potter Sanctuary",
  description:
    "Explore the bodywork treatments at The Potter Sanctuary in Beck Row, Suffolk — full body aromatherapy, back/neck/scalp, hot stones full body, and hot stones back.",
  path: "/treatments",
});

export default function TreatmentsPage() {
  return (
    <>
      <Nav />
      <main className="info-page">
        <header className="info-page-header">
          <p className="info-eyebrow">The Potter Sanctuary</p>
          <h1>Our Treatments</h1>
          <p className="info-lede">
            Each session is unhurried, plant-based, and delivered personally by
            a fully trained Clarins therapist.
          </p>
        </header>
        <div className="info-shell">
          {services.map((s) => (
            <article key={s.slug} className="info-card">
              <header className="info-card-head">
                <h2>
                  {s.name} <em>{s.nameEm}</em>
                </h2>
                <div className="info-card-meta">
                  <span>{s.duration}</span>
                  <span aria-hidden="true">·</span>
                  <span>{s.priceLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{s.pressure} pressure</span>
                </div>
              </header>
              {s.longDesc.slice(0, 2).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <div className="info-card-actions">
                <Link href={`/services/${s.slug}`} className="info-link">
                  Read full details →
                </Link>
                <Link
                  href={`/?scrollTo=booking#${s.bookingId}`}
                  className="info-cta"
                >
                  Book this treatment
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
