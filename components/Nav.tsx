"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  homeAnchors?: boolean;
};

export default function Nav({ homeAnchors = false }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: { user?: { id: string } | null }) => {
        if (!cancelled) setSignedIn(!!data.user);
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Booking CTA still anchors to the homepage booking section. From any
  // page other than `/`, send through ?scrollTo=booking so HashScroll
  // smooths into the booking calendar after the nav lands.
  const bookingHref = homeAnchors ? "#booking" : "/?scrollTo=booking";

  return (
    <nav className={`top${scrolled ? " scrolled" : ""}`} id="nav">
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
        <Link href="/">Home</Link>
        <Link href="/treatments">Treatments</Link>
        <Link href="/visit">Visit</Link>
        {signedIn === true ? (
          <Link href="/account">Account</Link>
        ) : signedIn === false ? (
          <Link href="/login">Sign in</Link>
        ) : null}
      </div>
      <Link href={bookingHref} className="cta">
        Book a Treatment
      </Link>
    </nav>
  );
}
