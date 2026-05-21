"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

type Props = {
  // True on the homepage — sections live on the same page so we can
  // intercept clicks and smooth-scroll directly. Elsewhere we route
  // through /?scrollTo=<id> and HashScroll handles it after navigation.
  homeAnchors?: boolean;
  // Force the sage-backed look from initial paint (legal pages etc).
  solid?: boolean;
};

const NAV_ITEMS: Array<{ label: string; anchor: string }> = [
  { label: "Treatments", anchor: "services" },
  { label: "Products", anchor: "products" },
  { label: "Booking", anchor: "booking" },
];

export default function Nav({ homeAnchors = false, solid = false }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // While the overlay is open: lock body scroll, close on ESC, and trap
  // focus inside the menu.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (e.key === "Tab" && overlayRef.current) {
        const focusables = overlayRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])"
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      overlayRef.current
        ?.querySelector<HTMLElement>("a[href], button")
        ?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  function hrefFor(anchor: string): string {
    return homeAnchors ? `#${anchor}` : `/?scrollTo=${anchor}`;
  }

  function onAnchorClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    anchor: string
  ) {
    // On the homepage, smooth-scroll directly to the section. Native hash
    // navigation / Next's scroll handling was landing inconsistently
    // (sometimes the page bottom); driving scrollIntoView ourselves — with
    // scroll-margin-top on the sections clearing the fixed nav — is
    // reliable.
    if (homeAnchors) {
      const el = document.getElementById(anchor);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    setMenuOpen(false);
  }

  return (
    <nav className={`top${scrolled || solid ? " scrolled" : ""}`} id="nav">
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
          <Link
            key={item.anchor}
            href={hrefFor(item.anchor)}
            onClick={(e) => onAnchorClick(e, item.anchor)}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="nav-right">
        <Link
          href={hrefFor("booking")}
          className="cta"
          onClick={(e) => onAnchorClick(e, "booking")}
        >
          <span className="cta-full">Book a Treatment</span>
          <span className="cta-short">Book</span>
        </Link>
        <button
          type="button"
          className="nav-burger"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="nav-overlay"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={26} aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <div
          className="nav-overlay"
          id="nav-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          ref={overlayRef}
        >
          <button
            type="button"
            className="nav-overlay-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={28} aria-hidden="true" />
          </button>
          <div className="nav-overlay-links">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.anchor}
                href={hrefFor(item.anchor)}
                onClick={(e) => onAnchorClick(e, item.anchor)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
