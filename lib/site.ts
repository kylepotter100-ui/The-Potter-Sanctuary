export const siteConfig = {
  name: "The Potter Sanctuary",
  tagline: "Plant-based body therapies in Beck Row, Suffolk",
  description:
    "A private body-therapy studio in Beck Row, Suffolk. Every session is led personally by a fully trained Clarins therapist using whipped, plant-based products made in small batches by PrecyseByNature.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.thepottersanctuary.co.uk",
  // TODO: replace with the studio's real address before launch.
  address: {
    streetAddress: "Studio address shared on booking",
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
    phone: "+44 7000 000 000",
    instagram: "@thepottersanctuary",
  },
  hours: {
    days: "Tue – Sat",
    times: "9:30 am – 7:00 pm",
    openingHoursSpec: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "09:30",
        closes: "19:00",
      },
    ],
  },
  priceRange: "££",
} as const;

export const ogDefaults = {
  siteName: siteConfig.name,
  locale: "en_GB",
  type: "website" as const,
};
