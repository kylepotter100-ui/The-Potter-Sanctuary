import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import { siteConfig } from "@/lib/site";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Lora({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#9CA98A",
  width: "device-width",
  initialScale: 1,
};

// Site-wide brand description used by both the page <meta description>
// and the social preview. Kept short (<= 200 chars) so platforms don't
// truncate awkwardly.
const SOCIAL_DESCRIPTION =
  "Private wellness studio offering aromatherapy, hot stones and bodywork in Beck Row, Suffolk.";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Plant-Based Body Therapy in Suffolk`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  // Favicon set. We currently fall back to the brand PNG for both shapes
  // — replace `/favicon.ico` and `/apple-touch-icon.png` once you've
  // generated proper multi-size icons (see /public/README in repo).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/sanctuary-logo.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  // Social preview. Cards use the OG image at /og-image.png (PNG preferred
  // over SVG for cross-platform support — Twitter, iMessage, WhatsApp).
  openGraph: {
    title: siteConfig.name,
    description: SOCIAL_DESCRIPTION,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — Beck Row, Suffolk`,
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: SOCIAL_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
