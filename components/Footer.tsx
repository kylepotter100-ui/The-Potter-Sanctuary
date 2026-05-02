import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { services } from "@/lib/services";

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
            {siteConfig.address.streetAddress}
            <br />
            {siteConfig.address.addressLocality},{" "}
            {siteConfig.address.addressRegion} {siteConfig.address.postalCode}
            <br />
            United Kingdom
          </address>
        </div>
        <div className="col">
          <h5>Visit</h5>
          <ul>
            <li>By appointment</li>
            <li>{siteConfig.hours.days}</li>
            <li>{siteConfig.hours.times}</li>
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
            <li>
              <a href={`tel:${siteConfig.contact.phone.replace(/\s/g, "")}`}>
                {siteConfig.contact.phone}
              </a>
            </li>
            <li>
              <a
                href={`https://instagram.com/${siteConfig.contact.instagram.replace(
                  /^@/,
                  ""
                )}`}
                rel="me"
              >
                {siteConfig.contact.instagram}
              </a>
            </li>
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
