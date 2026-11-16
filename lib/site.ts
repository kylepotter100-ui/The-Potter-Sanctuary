export const siteConfig = {
  name: "The Potter Sanctuary",
  tagline: "Plant-based body therapies in Beck Row, Suffolk",
  description:
    "A private body-therapy studio in Beck Row, Suffolk. Every session is led personally by a fully trained Clarins therapist using whipped, plant-based products made in small batches by Precyse By Nature.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://thepottersanctuary.co.uk",
  // BEFORE LAUNCH: add the contact phone to `contact.phone` — renders in the
  // Footer and JSON-LD only when non-empty.
  address: {
    // Typed as `string` so consumers can render or omit it conditionally
    // without TS narrowing the literal "" to `never`.
    streetAddress: "Lockheed Close" as string,
    addressLocality: "Beck Row",
    addressRegion: "Suffolk",
    postalCode: "IP28 3AB",
    addressCountry: "GB",
  },
  // TODO: confirm coordinates of the studio.
  geo: {
    latitude: 52.3697,
    longitude: 0.5039,
  },
  contact: {
    email: "hello@thepottersanctuary.co.uk",
    // Empty until the owner provides a number — Footer skips the row
    // when this is blank. Typed as `string` (not the literal "") so
    // consumers can safely call .replace() inside truthy branches.
    phone: "" as string,
    instagram: "@thepottersanctuary",
    instagramUrl: "https://www.instagram.com/thepottersanctuary/",
  },
  hours: {
    // Studio operates by appointment any day of the week — actual
    // availability is set per-date by the owner via the admin
    // availability page, and the booking calendar is the source of
    // truth. We deliberately don't quote fixed opening hours here.
    days: "By appointment, Monday to Sunday",
    note: "Availability varies by day",
    times: null,
  },
  priceRange: "££",
  // Cancellation/reschedule notice the studio asks for (Terms: a courtesy —
  // late changes are still allowed online until 15 minutes before, but are
  // flagged to the owner and shown to the client).
  noticeHours: 12,
  logo: "/sanctuary-logo.png",
  // Full studio address. Only ever shown to clients with a booking (emails,
  // calendar invites) — the public site says "address shared on booking".
  privateAddress: "22 Lockheed Close, Beck Row, IP28 3AB",
  // Optional arrival note for confirmation emails (parking, door, etc.).
  // Empty = section shows only the address and map link.
  arrivalNotes: "" as string,
  // Search-engine listing link for "Get directions" and JSON-LD hasMap.
  // Town + postcode rather than the unconfirmed coordinates below.
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=Beck+Row%2C+Suffolk+IP28+3AB",
  // The therapist. Leave `name` empty until the owner confirms how she wants
  // to be named publicly — the Person schema is only emitted when it's set.
  practitioner: {
    name: "" as string,
    jobTitle: "Massage & body therapist",
    credential: "Clarins-trained therapist",
  },
  // Cloudflare Web Analytics beacon token (cookie-free). Empty = no beacon.
  // NEXT_PUBLIC_* is inlined at build, so set it in the build env or here.
  analyticsToken: (process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN ?? "") as string,
  // Cloudflare Turnstile SITE key (public by design). NEXT_PUBLIC_* is inlined
  // at build time, so the literal is the real safety net (CLAUDE.md rule 4).
  turnstileSiteKey:
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "0x4AAAAAAGDX2jhLiZDM7Mfh",
} as const;

export const ogDefaults = {
  siteName: siteConfig.name,
  locale: "en_GB",
  type: "website" as const,
};
