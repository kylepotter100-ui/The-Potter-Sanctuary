# The Potter Sanctuary

A private body-therapy studio in Beck Row, Suffolk — where every session is led personally by a fully trained Clarins therapist using whipped, plant-based products made in small batches by PrecyseByNature.

This repository holds the code for the studio's website: the public landing page and the service pages that follow, with room to grow into bookings, gift vouchers, and journal content over time.

---

## About the Studio

The Potter Sanctuary is built around two ideas:

1. **Skilled but unhurried.** Treatments are delivered by a fully trained Clarins therapist — a qualification grounded in decades of European facial and bodywork tradition. Sessions are paced so that nothing feels rushed. What clients take home is calm.
2. **Plant-based, small-batch, no shortcuts.** Every product touching the skin is whipped, plant-based and made in small batches by PrecyseByNature — pure essential oils, no synthetic perfume, no fillers.

The website should communicate both at a glance.

---

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Images:** `next/image`
- **Sitemap:** [`next-sitemap`](https://github.com/iamvishnusankar/next-sitemap) wired into the build step
- **Hosting:** [Cloudflare Pages](https://pages.cloudflare.com/)
- **Language:** TypeScript

The design is being created in Claude Design and will be implemented page-for-page as it lands.

---

## Getting Started

```bash
# install dependencies
npm install

# copy the env template, then fill in real values
cp .env.example .env.local

# start the dev server
npm run dev

# production build (also generates the sitemap)
npm run build

# preview the production build locally
npm run start
```

The dev server runs at <http://localhost:3000>.

### Environment variables

| Variable                | Required | Description                                                                            |
| ----------------------- | :------: | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`  |    ✅    | Public origin of the site. Drives canonical URLs, OG tags, JSON-LD, and the sitemap.   |
| `RESEND_API_KEY`        |    ✅    | API key from [Resend](https://resend.com). Used by the booking API route.              |
| `BOOKING_EMAIL_TO`      |    ✅    | Inbox that receives booking enquiries (e.g. `hello@thepottersanctuary.co.uk`).         |
| `BOOKING_EMAIL_FROM`    |    ✅    | Verified Resend sender address on a domain you've added & verified in Resend.          |

`.env.example` contains the same keys with placeholder values.

---

## Project Structure

```
app/
  layout.tsx              # Root layout, default metadata, fonts
  page.tsx                # Homepage (intro, hero, philosophy, services, products, booking)
  services/
    [slug]/page.tsx       # Each treatment gets its own dedicated route
  api/
    booking/route.ts      # POST handler — emails the studio via Resend (edge runtime)
  not-found.tsx           # 404 page
  globals.css             # Design tokens + ported CSS from the original export
components/               # Reusable UI primitives (Nav, Footer, Intro, Booking, …)
lib/
  site.ts                 # Studio config (address, hours, contact)
  services.ts             # Service catalogue (single source of truth)
  seo.ts                  # Metadata + JSON-LD helpers
public/
  products/               # Product imagery (lifted from the design bundle)
  og/                     # Open Graph images
next-sitemap.config.cjs   # Sitemap + robots.txt generator
```

The `services/[slug]` route is deliberate — each treatment is its own indexable page so it can rank for its own long-tail keyword. Service data is centralised in `lib/services.ts`; the homepage cards, the dynamic detail pages, the footer, and the booking form all read from it. Add a treatment by appending to that array — routes, metadata, JSON-LD, and the booking dropdown wire up automatically.

---

## SEO Standards

These apply to **every** page, not just the homepage. They are non-negotiable.

### Metadata
- Use the Next.js Metadata API for `title` and `description` per page.
- Open Graph tags on every page (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`).
- Twitter card tags as a fallback for share previews.
- Canonical URL set per page.

### Structured Data
- JSON-LD `LocalBusiness` schema on the homepage, including:
  - Business name, full address, geo coordinates
  - Opening hours
  - Phone, email
  - Price range
  - Linked `Person` for the therapist (Clarins-trained credential)
- Each service page emits a `Service` schema referencing the parent `LocalBusiness`.

### Routing
- Each service has its own dedicated route at `/services/[slug]`.
- `next-sitemap` generates `sitemap.xml` and `robots.txt` on build.
- Internal linking: homepage links to every service page; every service page links back home and across to its siblings.

### Content & HTML
- Semantic HTML — exactly **one `<h1>` per page**, with a logical `<h2>`/`<h3>` hierarchy beneath it.
- All images via `next/image` with descriptive `alt` text (no decorative-only images marked as content).
- Footer carries the full address on every page for local-SEO signals.
- No layout shift on first paint — fonts preloaded, images sized.

### Performance
- Core Web Vitals are part of the SEO contract. Aim for green LCP, CLS, INP on mobile.
- Static-render service pages where possible.

---

## Keyword Strategy

Treat this section as the source of truth for page intent. If you're writing or editing copy, the page's primary keyword goes in the `<h1>`, the metadata title, and at least once in the opening paragraph.

### Homepage — primary keywords
Broad local intent:

- massage therapist Beck Row
- beauty therapist Beck Row Suffolk
- body therapy studio Suffolk
- Clarins therapist Suffolk
- private massage studio Beck Row
- holistic therapist Mildenhall *(nearest larger town)*
- holistic therapist Newmarket

### Aromatherapy page (`/services/aromatherapy`)

- full body aromatherapy massage Suffolk
- aromatherapy massage Beck Row
- essential oil massage therapy Suffolk
- relaxing aromatherapy treatment near Mildenhall
- plant-based massage Suffolk

### Hot Stones Full Body page (`/services/hot-stones-full-body`)

- hot stone massage Suffolk
- hot stones full body treatment Beck Row
- deep relaxation hot stone therapy Suffolk

### Hot Stones Back page (`/services/hot-stones-back`)

- hot stone back massage Suffolk
- hot stones back treatment Beck Row
- back tension hot stone therapy Suffolk

### Back, Neck & Scalp page (`/services/back-neck-scalp`)

- back neck and scalp massage Suffolk
- tension relief massage Beck Row
- back massage near Mildenhall
- scalp massage treatment Suffolk

### Brand & trust keywords
Weave these into body copy across the site — they support conversion rather than ranking:

- Clarins trained therapist
- PrecyseByNature products
- plant-based beauty treatment Suffolk
- luxury private massage studio Suffolk
- unhurried body therapy Suffolk
- small batch skincare massage Suffolk

### "Near me" long-tail
Use these in JSON-LD and the Google Business Profile description rather than on-page H1s:

- best massage therapist near RAF Mildenhall
- private beauty studio West Suffolk
- relaxation therapy near Bury St Edmunds
- mobile-free massage experience Suffolk

---

## Editorial Voice

When writing or reviewing copy, three rules:

1. **Unhurried.** Sentences breathe. No exclamation marks. No urgency tactics.
2. **Specific.** "Whipped, plant-based, small-batch" beats "natural and luxurious" every time.
3. **Credible.** The Clarins training and PrecyseByNature products are the trust anchors. Reference them by name.

---

## Deployment

The site deploys to Cloudflare Pages. Build command: `npm run build`. Output directory: as configured for the Next.js Cloudflare adapter.

Production: TBD (custom domain to be wired up).

---

## Roadmap

Done in this iteration:

- [x] Homepage from Claude Design (intro, hero, ribbon, philosophy, services, products, booking, footer)
- [x] Aromatherapy, Back/Neck/Scalp, Hot Stones Full Body, Hot Stones Back service pages
- [x] JSON-LD `LocalBusiness` + per-service `Service` schemas
- [x] `next-sitemap` configured (regenerates `sitemap.xml` and `robots.txt` on every build)
- [x] Booking flow with email delivery via Resend

Before launch:

- [ ] Replace placeholder address, phone, and geo coordinates in `lib/site.ts`
- [ ] Drop real photography into `public/` and replace the placeholder boxes (treatment room, therapist portrait, service cards)
- [ ] Replace `public/og/default.svg` with a 1200×630 PNG (most social platforms don't render SVG previews)
- [ ] Verify a sending domain in Resend and configure `BOOKING_EMAIL_FROM`
- [ ] Wire the "Visit the shop" CTA to the live PrecyseByNature URL
- [ ] Connect Cloudflare Pages deployment

Post-launch:

- [ ] Real availability / online booking integration (replace the pseudo-random slot logic in `components/Booking.tsx`)
- [ ] Gift vouchers
- [ ] Journal / blog for long-tail content

---

## Licence

All rights reserved. The Potter Sanctuary brand, copy, and imagery are not licensed for reuse.
