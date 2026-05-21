export const siteConfig = {
  name: "The Potter Sanctuary",
  tagline: "Plant-based body therapies in Beck Row, Suffolk",
  description:
    "A private body-therapy studio in Beck Row, Suffolk. Every session is led personally by a fully trained Clarins therapist using whipped, plant-based products made in small batches by PrecyseByNature.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.thepottersanctuary.co.uk",
  // BEFORE LAUNCH: add the studio's real street address to `streetAddress`
  // and the contact phone to `contact.phone`. Both render in the Footer
  // and JSON-LD only when non-empty.
  address: {
    // Typed as `string` so consumers can render or omit it conditionally
    // without TS narrowing the literal "" to `never`.
    streetAddress: "" as string,
    addressLocality: "Beck Row",
    addressRegion: "Suffolk",
    postalCode: "IP28",
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
} as const;

export const ogDefaults = {
  siteName: siteConfig.name,
  locale: "en_GB",
  type: "website" as const,
};
