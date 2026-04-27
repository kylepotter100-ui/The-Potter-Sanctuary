import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Ribbon from "@/components/Ribbon";
import Booking from "@/components/Booking";
import HeroCta from "@/components/HeroCta";
import JsonLd from "@/components/JsonLd";
import { services, getService, serviceSlugs } from "@/lib/services";
import { pageMetadata, serviceJsonLd } from "@/lib/seo";

type Params = { slug: string };

export function generateStaticParams() {
  return serviceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  return pageMetadata({
    title: service.seo.title,
    description: service.seo.description,
    path: `/services/${service.slug}`,
  });
}

export default async function ServicePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const others = services.filter((s) => s.slug !== service.slug);

  return (
    <>
      <Nav />
      <div className="page show">
        {/* HERO */}
        <section className="hero">
          <div className="hero-text">
            <div className="hero-eyebrow">{service.number}</div>
            <h1>{service.seo.h1}</h1>
            <p className="lede">{service.shortDesc}</p>
            <div className="hero-actions">
              <HeroCta target="#booking">
                Reserve {service.priceLabel} ·{" "}
                <span aria-hidden="true">→</span>
              </HeroCta>
              <HeroCta target="#detail" variant="ghost">
                What to expect
              </HeroCta>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-frame">
              <div className="ph-label">
                <div className="l1">{service.imageLabel.l1}</div>
                <div className="l2">{service.imageLabel.l2}</div>
              </div>
            </div>
          </div>
          <div className="hero-meta">
            <div className="pill">
              <span className="k">{service.duration}</span>
              <span className="v">Duration</span>
            </div>
            <div className="divider" />
            <div className="pill">
              <span className="k">{service.priceLabel}</span>
              <span className="v">Per Session</span>
            </div>
            <div className="divider" />
            <div className="pill">
              <span className="k">{service.suitedTo}</span>
              <span className="v">Suited To</span>
            </div>
          </div>
        </section>

        <Ribbon />

        {/* DETAIL */}
        <section className="section cream" id="detail">
          <div className="container philo">
            <div className="img">
              <div className="ph-label">
                <div className="l1">{service.imageLabel.l1}</div>
                <div className="l2">{service.imageLabel.l2}</div>
              </div>
            </div>
            <div>
              <div className="eyebrow">What to expect</div>
              <h2 className="section-title">
                {service.name} <em>{service.nameEm}</em>
              </h2>
              {service.longDesc.map((p, i) => (
                <p key={i} style={i === 0 ? { marginTop: 28 } : undefined}>
                  {p}
                </p>
              ))}
              <div className="credentials">
                <div className="c">
                  <span className="k">{service.duration}</span>
                  <span className="v">Duration</span>
                </div>
                <div className="c">
                  <span className="k">{service.pressure}</span>
                  <span className="v">Pressure</span>
                </div>
                <div className="c">
                  <span className="k">{service.priceLabel}</span>
                  <span className="v">Per Session</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BOOKING */}
        <section className="section sage-deep" id="booking">
          <div className="container booking-wrap">
            <div className="booking-side">
              <div
                className="eyebrow"
                style={{ color: "var(--cream)", opacity: 0.85 }}
              >
                Make a Reservation
              </div>
              <h2 className="section-title">
                Book your <em>quiet hour.</em>
              </h2>
              <p
                className="section-lede"
                style={{ color: "var(--cream)", opacity: 0.85 }}
              >
                Choose a date, confirm the treatment, and add a few details —
                we'll confirm by message within the day. The studio takes one
                guest at a time.
              </p>
            </div>
            <Booking preselectId={service.bookingId} />
          </div>
        </section>

        {/* OTHER TREATMENTS */}
        <section className="section sage">
          <div className="container">
            <div className="services-intro">
              <div>
                <div
                  className="eyebrow"
                  style={{ color: "var(--cream)", opacity: 0.85 }}
                >
                  Also at the studio
                </div>
                <h2 className="section-title">
                  Other treatments <em>at the sanctuary.</em>
                </h2>
              </div>
              <div className="right">
                A small, considered menu. Each treatment has its own page and
                its own ritual.
              </div>
            </div>
            {others.map((s, i) => (
              <article
                key={s.slug}
                className={`service${i % 2 === 1 ? " reverse" : ""}`}
              >
                <div className="svc-img">
                  <div className="ph-label">
                    <div className="l1">{s.imageLabel.l1}</div>
                    <div className="l2">{s.imageLabel.l2}</div>
                  </div>
                </div>
                <div>
                  <div className="svc-num">{s.number}</div>
                  <h3 className="svc-title">
                    {s.name} <em>{s.nameEm}</em>
                  </h3>
                  <div className="svc-meta">
                    <div className="m">
                      <span className="k">Duration</span>
                      <span>{s.duration}</span>
                    </div>
                    <div className="m">
                      <span className="k">Pressure</span>
                      <span>{s.pressure}</span>
                    </div>
                  </div>
                  <p className="svc-desc">{s.shortDesc}</p>
                  <div className="svc-price-row">
                    <div className="svc-price">{s.priceLabel}</div>
                    <Link
                      href={`/services/${s.slug}`}
                      className="svc-book"
                      style={{ textDecoration: "none" }}
                    >
                      Read more →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <Footer />
      </div>
      <JsonLd data={serviceJsonLd(service)} id="ld-service" />
    </>
  );
}
