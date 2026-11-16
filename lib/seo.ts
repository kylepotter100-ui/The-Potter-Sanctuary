import type { Metadata } from "next";
import { siteConfig } from "./site";
import type { Service } from "./services";

// 1200x630 PNG — most social platforms don't render SVG previews. Used as the
// default OG/Twitter card image and as the LocalBusiness JSON-LD `image`.
const DEFAULT_OG_IMAGE = "/og-image.png";

type PageMetaInput = {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  ogImageSize?: { width: number; height: number };
  /**
   * The title already contains the brand, so don't let the root layout's
   * "%s | The Potter Sanctuary" template append it a second time.
   */
  absoluteTitle?: boolean;
};

export function pageMetadata({
  title,
  description,
  path = "/",
  ogImage = DEFAULT_OG_IMAGE,
  ogImageSize = { width: 1200, height: 630 },
  absoluteTitle = false,
}: PageMetaInput): Metadata {
  const url = new URL(path, siteConfig.url).toString();
  const fullOgImage = ogImage.startsWith("http")
    ? ogImage
    : new URL(ogImage, siteConfig.url).toString();

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: "en_GB",
      type: "website",
      images: [{ url: fullOgImage, ...ogImageSize, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [fullOgImage],
    },
  };
}

const AREAS = [
  "Beck Row",
  "Mildenhall",
  "RAF Mildenhall",
  "Lakenheath",
  "RAF Lakenheath",
  "Newmarket",
  "Bury St Edmunds",
  "Brandon",
  "Ely",
  "West Suffolk",
];

const abs = (p: string) => new URL(p, siteConfig.url).toString();

export function localBusinessJsonLd(services: Service[] = []) {
  const practitioner = siteConfig.practitioner;
  return {
    "@context": "https://schema.org",
    // DaySpa is the closest schema.org type for a private treatment studio;
    // additionalType tells engines the core service is massage.
    "@type": "DaySpa",
    additionalType: "https://en.wikipedia.org/wiki/Massage",
    "@id": `${siteConfig.url}#business`,
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    image: abs(DEFAULT_OG_IMAGE),
    logo: abs(siteConfig.logo),
    // Only emit telephone / streetAddress / Person when set — validators
    // prefer a field omitted to a placeholder value.
    ...(siteConfig.contact.phone ? { telephone: siteConfig.contact.phone } : {}),
    email: siteConfig.contact.email,
    priceRange: siteConfig.priceRange,
    currenciesAccepted: "GBP",
    paymentAccepted: "Cash, Gift voucher",
    address: {
      "@type": "PostalAddress",
      ...(siteConfig.address.streetAddress
        ? { streetAddress: siteConfig.address.streetAddress }
        : {}),
      addressLocality: siteConfig.address.addressLocality,
      addressRegion: siteConfig.address.addressRegion,
      postalCode: siteConfig.address.postalCode,
      addressCountry: siteConfig.address.addressCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: siteConfig.geo.latitude,
      longitude: siteConfig.geo.longitude,
    },
    hasMap: siteConfig.mapUrl,
    // Hours are set per-date in the booking calendar (by appointment, varies
    // by day), so no fixed openingHoursSpecification — quoting hours we may
    // not be open is worse than omitting them.
    areaServed: AREAS.map((name) => ({ "@type": "Place", name })),
    ...(practitioner.name
      ? {
          employee: {
            "@type": "Person",
            name: practitioner.name,
            jobTitle: practitioner.jobTitle,
            hasCredential: {
              "@type": "EducationalOccupationalCredential",
              name: practitioner.credential,
            },
          },
        }
      : {}),
    ...(services.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Treatments",
            itemListElement: services.map((sv) => ({
              "@type": "Offer",
              price: sv.price.toString(),
              priceCurrency: "GBP",
              itemOffered: { "@id": `${abs(`/services/${sv.slug}`)}#service` },
            })),
          },
        }
      : {}),
    sameAs: [siteConfig.contact.instagramUrl],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}#website`,
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "en-GB",
    publisher: { "@id": `${siteConfig.url}#business` },
  };
}

export function serviceJsonLd(service: Service) {
  const url = abs(`/services/${service.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `${service.name} ${service.nameEm}`.trim(),
    description: service.shortDesc,
    url,
    image: abs(service.image.src),
    serviceType: service.serviceType,
    // Full provider node (not just an @id) so this page stands on its own —
    // the business node is otherwise only defined on the homepage.
    provider: {
      "@type": "DaySpa",
      "@id": `${siteConfig.url}#business`,
      name: siteConfig.name,
      url: siteConfig.url,
      address: {
        "@type": "PostalAddress",
        addressLocality: siteConfig.address.addressLocality,
        addressRegion: siteConfig.address.addressRegion,
        postalCode: siteConfig.address.postalCode,
        addressCountry: siteConfig.address.addressCountry,
      },
    },
    areaServed: AREAS.map((name) => ({ "@type": "Place", name })),
    offers: {
      "@type": "Offer",
      price: service.price.toString(),
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
      url,
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}
