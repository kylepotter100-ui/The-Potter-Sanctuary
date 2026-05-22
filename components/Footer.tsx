import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { services } from "@/lib/services";
import FooterAccountLink from "@/components/FooterAccountLink";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer" id="contact">
      <div className="grid">
        <div>
          <div className="brand-mark">
            <Image
              src="/sanctuary-logo.png"
              alt=""
              width={272}
              height={382}
            />
            <span>The Potter Sanctuary</span>
          </div>
          <p style={{ maxWidth: 340 }}>
            A private studio for natural, plant-based body therapies in Beck
            Row, Suffolk — by appointment only.
          </p>
          <address
            style={{
              fontStyle: "normal",
              marginTop: 18,
              fontSize: 13,
              lineHeight: 1.7,
              opacity: 0.78,
            }}
          >
            {siteConfig.address.streetAddress && (
              <>
                {siteConfig.address.streetAddress}
                <br />
              </>
            )}
            {siteConfig.address.addressLocality},{" "}
            {siteConfig.address.addressRegion}
            <br />
            United Kingdom
          </address>
        </div>
        <div className="col">
          <h5>Visit</h5>
          <ul>
            <li>{siteConfig.hours.days}</li>
            <li>{siteConfig.hours.note}</li>
            {siteConfig.hours.times && <li>{siteConfig.hours.times}</li>}
          </ul>
        </div>
        <div className="col">
          <h5>Contact</h5>
          <ul>
            <li>
              <a href={`mailto:${siteConfig.contact.email}`}>
                {siteConfig.contact.email}
              </a>
            </li>
            {siteConfig.contact.phone && (
              <li>
                <a href={`tel:${siteConfig.contact.phone.replace(/\s/g, "")}`}>
                  {siteConfig.contact.phone}
                </a>
              </li>
            )}
            <li>
              <a
                className="footer-instagram"
                href={siteConfig.contact.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="The Potter Sanctuary on Instagram"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
            </li>
            <FooterAccountLink />
          </ul>
        </div>
        <div className="col">
          <h5>Treatments</h5>
          <ul>
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`}>
                  {s.name} {s.nameEm}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="bottom">
        <span>© {year} The Potter Sanctuary</span>
        <nav className="footer-legal" aria-label="Legal">
          <Link href="/legal/privacy">Privacy Policy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/legal/terms">Terms of Service</Link>
          <span aria-hidden="true">·</span>
          <Link href="/legal/cookies">Cookies Policy</Link>
        </nav>
        <span>Made with care · Plant-based</span>
      </div>
    </footer>
  );
}
