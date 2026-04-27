import type { Metadata } from "next";
import { siteConfig } from "./site";
import type { Service } from "./services";

// TODO: replace with a 1200x630 PNG before launch — most social platforms
// don't render SVG previews. The SVG below is a placeholder so metadata
// validates locally.
const DEFAULT_OG_IMAGE = "/og/default.svg";

type PageMetaInput = {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
};

export function pageMetadata({
  title,
  description,
  path = "/",
  ogImage = DEFAULT_OG_IMAGE,
}: PageMetaInput): Metadata {
  const url = new URL(path, siteConfig.url).toString();
  const fullOgImage = ogImage.startsWith("http")
    ? ogImage
    : new URL(ogImage, siteConfig.url).toString();

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: "en_GB",
      type: "website",
      images: [{ url: fullOgImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [fullOgImage],
    },
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "@id": `${siteConfig.url}#business`,
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    image: new URL(DEFAULT_OG_IMAGE, siteConfig.url).toString(),
    telephone: siteConfig.contact.phone,
    email: siteConfig.contact.email,
    priceRange: siteConfig.priceRange,
    address: {
      "@type": "PostalAddress",
      ...siteConfig.address,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: siteConfig.geo.latitude,
      longitude: siteConfig.geo.longitude,
    },
    openingHoursSpecification: siteConfig.hours.openingHoursSpec,
    areaServed: [
      { "@type": "Place", name: "Beck Row" },
      { "@type": "Place", name: "Mildenhall" },
      { "@type": "Place", name: "Newmarket" },
      { "@type": "Place", name: "Bury St Edmunds" },
      { "@type": "Place", name: "RAF Mildenhall" },
      { "@type": "Place", name: "West Suffolk" },
    ],
    keywords: [
      "massage therapist Beck Row",
      "beauty therapist Beck Row Suffolk",
      "body therapy studio Suffolk",
      "Clarins therapist Suffolk",
      "private massage studio Beck Row",
      "holistic therapist Mildenhall",
      "holistic therapist Newmarket",
      "best massage therapist near RAF Mildenhall",
      "private beauty studio West Suffolk",
      "relaxation therapy near Bury St Edmunds",
      "mobile-free massage experience Suffolk",
    ].join(", "),
    sameAs: [
      `https://instagram.com/${siteConfig.contact.instagram.replace(/^@/, "")}`,
    ],
  };
}

export function serviceJsonLd(service: Service) {
  const url = new URL(`/services/${service.slug}`, siteConfig.url).toString();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `${service.name} ${service.nameEm}`.trim(),
    description: service.shortDesc,
    url,
    serviceType: service.category,
    provider: { "@id": `${siteConfig.url}#business` },
    areaServed: [
      { "@type": "Place", name: "Beck Row" },
      { "@type": "Place", name: "Mildenhall" },
      { "@type": "Place", name: "Suffolk" },
    ],
    offers: {
      "@type": "Offer",
      price: service.price.toString(),
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
      url,
    },
  };
}
