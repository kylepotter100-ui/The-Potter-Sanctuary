import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import Intro from "@/components/Intro";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Ribbon from "@/components/Ribbon";
import Booking from "@/components/Booking";
import HeroCta from "@/components/HeroCta";
import ServiceCardLink from "@/components/ServiceCardLink";
import JsonLd from "@/components/JsonLd";
import { services } from "@/lib/services";
import { localBusinessJsonLd, pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: `${siteConfig.name} — Body Therapy Studio in Beck Row, Suffolk`,
  description:
    "Private body therapy studio in Beck Row, Suffolk. Aromatherapy, hot stones, back-neck-and-scalp massage delivered personally by a fully trained Clarins therapist using plant-based PrecyseByNature products.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <Intro />
      <Nav homeAnchors />
      <div className="page" id="page">
        {/* HERO */}
        <section className="hero" id="top">
          <div className="hero-text">
            <div className="hero-eyebrow">A Sanctuary for the Senses</div>
            <h1>
              Stillness, distilled
              <br />
              <em>into ritual.</em>
            </h1>
            <p className="lede">
              A private treatment sanctuary in Beck Row, Suffolk, led by a
              five-star Clarins-trained therapist. Slow, intentional bodywork
              using plant-based whipped butters and essential oils — never
              anything synthetic.
            </p>
            <div className="hero-actions">
              <HeroCta target="#booking">
                Reserve your visit{" "}
                <span aria-hidden="true">→</span>
              </HeroCta>
              <HeroCta target="#services" variant="ghost">
                Explore treatments
              </HeroCta>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-frame">
              <div className="ph-label">
                <div className="l1">image — treatment room</div>
                <div className="l2">soft natural light · linen · stoneware</div>
              </div>
            </div>
          </div>
          <div className="hero-meta">
            <div className="pill">
              <span className="k">5★</span>
              <span className="v">Clarins Trained</span>
            </div>
            <div className="divider" />
            <div className="pill">
              <span className="k">100%</span>
              <span className="v">Plant-Based</span>
            </div>
            <div className="divider" />
            <div className="pill">
              <span className="k">By</span>
              <span className="v">Appointment Only</span>
            </div>
          </div>
        </section>

        <Ribbon />

        {/* PHILOSOPHY */}
        <section className="section cream" id="philosophy">
          <div className="container philo">
            <div className="img">
              <div className="ph-label">
                <div className="l1">image — therapist portrait</div>
                <div className="l2">soft, candid, in-room</div>
              </div>
            </div>
            <div>
              <div className="eyebrow">A quiet practice</div>
              <h2 className="section-title">
                A trained hand, <em>a natural touch.</em>
              </h2>
              <p style={{ marginTop: 28 }}>
                The Potter Sanctuary is a private studio devoted to body
                therapies that are at once skilled and unhurried. Every session
                is led personally by a fully trained Clarins therapist — a
                qualification grounded in decades of European facial and
                bodywork tradition.
              </p>
              <p>
                What you bring home is the calm of nothing rushed. What goes
                onto your skin is whipped, plant-based and made in small batches
                by <em>PrecyseByNature</em> — pure essential oils, no synthetic
                perfume, no fillers.
              </p>
              <div className="credentials">
                <div className="c">
                  <span className="k">5★</span>
                  <span className="v">Clarins Trained</span>
                </div>
                <div className="c">
                  <span className="k">100%</span>
                  <span className="v">Plant-based products</span>
                </div>
                <div className="c">
                  <span className="k">1:1</span>
                  <span className="v">Private appointments</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section className="section sage" id="services">
          <div className="container">
            <div className="services-intro">
              <div>
                <div
                  className="eyebrow"
                  style={{ color: "var(--cream)", opacity: 0.85 }}
                >
                  The Treatment Menu
                </div>
                <h2 className="section-title">
                  Four treatments, <em>each its own ritual.</em>
                </h2>
              </div>
              <div className="right">
                A small, considered menu — so each treatment can be given the
                time it deserves. Every session begins with a warm welcome,
                ends with herbal tea, and is tailored to your skin and
                intention on the day.
              </div>
            </div>

            {services.map((s, i) => (
              <article
                key={s.slug}
                className={`service${s.reverse ? " reverse" : ""}`}
                id={`svc-${i + 1}`}
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
                    <div className="m">
                      <span className="k">Suited to</span>
                      <span>{s.suitedTo}</span>
                    </div>
                  </div>
                  <p className="svc-desc">{s.shortDesc}</p>
                  <div className="svc-price-row">
                    <div className="svc-price">{s.priceLabel}</div>
                    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                      <Link
                        href={`/services/${s.slug}`}
                        className="svc-book"
                        style={{ textDecoration: "none" }}
                      >
                        Read more →
                      </Link>
                      <ServiceCardLink bookingId={s.bookingId} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* PRODUCTS */}
        <section className="section bone" id="products">
          <div className="container">
            <div className="products-intro">
              <div>
                <div className="eyebrow">Made by PrecyseByNature</div>
                <h2 className="section-title">
                  The products <em>used &amp; loved.</em>
                </h2>
              </div>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.8,
                  opacity: 0.85,
                  maxWidth: 480,
                }}
              >
                Whipped, slow-stirred and infused in small batches. Plant-based
                by principle and unscented except by the essential oils
                themselves — exactly what we use in the studio, available to
                take home.
              </p>
            </div>

            <div className="products">
              <div className="product">
                <div className="img">
                  <Image
                    src="/products/whipped-body-butter.webp"
                    alt="PrecyseByNature plant-whipped body butter jars on linen"
                    width={800}
                    height={600}
                    sizes="(max-width: 960px) 100vw, 50vw"
                  />
                </div>
                <div className="body">
                  <div className="tag">Whipped Body Butter</div>
                  <h3>Plant-Whipped Butter</h3>
                  <p>
                    Shea, mango and cocoa whipped to a cloud, infused with rose,
                    neroli or unscented. Melts on contact and leaves nothing
                    greasy behind.
                  </p>
                </div>
              </div>
              <div className="product">
                <div className="img">
                  <Image
                    src="/products/sugar-scrub.webp"
                    alt="PrecyseByNature sugar scrub jars with embossed lids"
                    width={800}
                    height={600}
                    sizes="(max-width: 960px) 100vw, 50vw"
                  />
                </div>
                <div className="body">
                  <div className="tag">Sugar Scrub</div>
                  <h3>Slow-Stirred Scrub</h3>
                  <p>
                    Raw cane sugar suspended in cold-pressed oils — a kind
                    exfoliation that polishes without abrasion. Recommended
                    before a body treatment.
                  </p>
                </div>
              </div>
            </div>

            <div className="shop-cta">
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Shop the range
                </div>
                <div className="shop-cta-headline">
                  The full PrecyseByNature collection
                </div>
                <div className="shop-cta-note">
                  Direct link coming soon — bookmark for launch.
                </div>
              </div>
              {/* TODO: replace href with the live PrecyseByNature shop URL once available. */}
              <a href="#" className="shop-cta-link">
                Visit the shop <span aria-hidden="true">→</span>
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
                Choose a date, a treatment, and a few details — we'll confirm
                your appointment by message within the day. All visits are
                private and unhurried; the studio takes one guest at a time.
              </p>
              <div className="info">
                <div className="row">
                  <div className="lab">Hours</div>
                  <div className="val">
                    {siteConfig.hours.days}
                    <br />
                    {siteConfig.hours.times}
                  </div>
                </div>
                <div className="row">
                  <div className="lab">Studio</div>
                  <div className="val">
                    {siteConfig.address.addressLocality},{" "}
                    {siteConfig.address.addressRegion}
                    <br />
                    Address shared on booking
                  </div>
                </div>
                <div className="row">
                  <div className="lab">Cancel</div>
                  <div className="val">24 hours notice, kindly</div>
                </div>
              </div>
            </div>

            <Booking />
          </div>
        </section>

        <Footer />
      </div>
      <JsonLd data={localBusinessJsonLd()} id="ld-local-business" />
    </>
  );
}
