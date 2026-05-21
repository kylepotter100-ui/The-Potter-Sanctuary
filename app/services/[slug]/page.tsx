import type { Metadata } from "next";
import Image from "next/image";
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

  // Split the existing longDesc paragraphs into two roughly-equal halves
  // for the two alternating editorial blocks (verbatim copy, no rewrite).
  // 3 paragraphs → [0,1] in the first block, [2] in the second.
  const splitAt = Math.ceil(service.longDesc.length / 2);
  const detailFirst = service.longDesc.slice(0, splitAt);
  const detailSecond = service.longDesc.slice(splitAt);

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
              <Image
                src={service.image.src}
                alt={service.image.alt}
                fill
                priority
                sizes="(max-width: 600px) 92vw, (max-width: 960px) 88vw, 560px"
                style={{ objectFit: "cover" }}
              />
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

        {/* DETAIL — editorial alternating blocks */}
        <section className="section cream" id="detail">
          <div className="container">
            {/* CONTENT 1 — image left, "What to expect" */}
            <article className="treatment-block">
              <figure className="treatment-block-img">
                <Image
                  src={service.images.gallery[0]}
                  alt={`The ${service.name} ${service.nameEm} treatment room at The Potter Sanctuary`}
                  width={1000}
                  height={800}
                  sizes="(max-width: 860px) 92vw, 440px"
                />
              </figure>
              <div className="treatment-block-copy">
                <div className="eyebrow">What to expect</div>
                <h2 className="section-title">
                  {service.name} <em>{service.nameEm}</em>
                </h2>
                {detailFirst.map((p, i) => (
                  <p key={i} style={i === 0 ? { marginTop: 24 } : undefined}>
                    {p}
                  </p>
                ))}
              </div>
            </article>

            {/* CONTENT 2 — text left, image right, "The experience" */}
            <article className="treatment-block reverse">
              <figure className="treatment-block-img">
                <Image
                  src={service.images.gallery[1]}
                  alt={`Plant-based oils and warm towels for the ${service.name} ${service.nameEm} treatment`}
                  width={1000}
                  height={800}
                  sizes="(max-width: 860px) 92vw, 440px"
                />
              </figure>
              <div className="treatment-block-copy">
                <div className="eyebrow">The experience</div>
                <h2 className="section-title">
                  Tailored <em>to you.</em>
                </h2>
                {detailSecond.map((p, i) => (
                  <p key={i} style={i === 0 ? { marginTop: 24 } : undefined}>
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
            </article>

            {/* BOOK CTA */}
            <div className="treatment-cta">
              <a href="#booking" className="treatment-cta-btn">
                Book this treatment
              </a>
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
                  <Image
                    src={s.image.src}
                    alt={s.image.alt}
                    fill
                    sizes="(max-width: 960px) 100vw, 50vw"
                    style={{ objectFit: "cover" }}
                  />
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
