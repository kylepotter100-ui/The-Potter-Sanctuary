"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  // True on the homepage — we can use plain hash anchors because the
  // sections live on the same page. On any other page we route through
  // /?scrollTo=<id> so HashScroll smooth-scrolls after navigation.
  homeAnchors?: boolean;
  // Force the sage-backed look from initial paint. Use on any page whose
  // body sits behind the (fixed) nav with a non-sage background — e.g.
  // legal pages. Without this the nav's cream text is invisible.
  solid?: boolean;
};

const NAV_ITEMS: Array<{ label: string; anchor: string }> = [
  { label: "Treatments", anchor: "services" },
  { label: "Products", anchor: "products" },
  { label: "Booking", anchor: "booking" },
];

export default function Nav({ homeAnchors = false, solid = false }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // From the homepage we can link straight to `#anchor`. From any other
  // page we send through /?scrollTo=anchor — HashScroll then smooth-
  // scrolls to the matching id after navigation lands.
  function hrefFor(anchor: string): string {
    return homeAnchors ? `#${anchor}` : `/?scrollTo=${anchor}`;
  }

  return (
    <nav
      className={`top${scrolled || solid ? " scrolled" : ""}`}
      id="nav"
    >
      <Link href="/" className="brand" aria-label="The Potter Sanctuary, home">
        <Image
          src="/sanctuary-logo.png"
          alt=""
          width={272}
          height={382}
          priority
          className="brand-logo"
        />
        <span className="name">The Potter Sanctuary</span>
      </Link>
      <div className="links">
        {NAV_ITEMS.map((item) => (
          <Link key={item.anchor} href={hrefFor(item.anchor)}>
            {item.label}
          </Link>
        ))}
      </div>
      <Link href={hrefFor("booking")} className="cta">
        Book a Treatment
      </Link>
    </nav>
  );
}
