"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  homeAnchors?: boolean;
};

export default function Nav({ homeAnchors = false }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const link = (anchor: string) => (homeAnchors ? `#${anchor}` : `/#${anchor}`);

  return (
    <nav className={`top${scrolled ? " scrolled" : ""}`} id="nav">
      <Link href="/" className="brand" aria-label="The Potter Sanctuary, home">
        <Image
          src="/Sanctuary logo.png"
          alt=""
          width={272}
          height={382}
          priority
          className="brand-logo"
        />
        <span className="name">The Potter Sanctuary</span>
      </Link>
      <div className="links">
        <Link href={link("philosophy")}>Philosophy</Link>
        <Link href={link("services")}>Services</Link>
        <Link href={link("products")}>Products</Link>
        <Link href={link("booking")}>Booking</Link>
        <Link href={link("contact")}>Contact</Link>
      </div>
      <Link href={link("booking")} className="cta">
        Book a Treatment
      </Link>
    </nav>
  );
}

