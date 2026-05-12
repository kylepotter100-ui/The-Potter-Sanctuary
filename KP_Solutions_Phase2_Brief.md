# KP Solutions — Phase 2 Implementation Brief

**For:** Claude Code (Plan Mode)
**Scope:** Finishing touches — functional footer, legal pages, cookie consent, dedicated service pages with industries served, About page, and small SEO/conversion improvements.
**Branch:** New feature branch (e.g. `claude/phase-2-finishing-touches`). All commits push there.

---

## 1. Context — Read This First

The homepage repositioning has shipped at `kpsolutions.io`. This phase adds the structural pages and conversion infrastructure that a production-ready studio site needs:

- A functional footer (currently static text, no working links)
- Legal pages (Privacy, Terms, Cookies) with proper routing and a working consent banner
- Dedicated service pages for each of the four pillars, expanded with industries served
- An About page (the "one person, end to end" pitch requires the page to actually say who that person is)
- A hero refinement: swap the Recently Shipped tile for a testimonial OR remove cleanly if no testimonial is available yet
- Small wins: Cal.com/Calendly link, schema markup, Journal link decision

**What stays as-is:** the visual design system, typography, four-pillar copy on the homepage, the Process and Why KP Solutions sections, the Selected Work section.

**Important: legal copy is placeholder.** This brief scaffolds the page structure and layout. Actual legal copy must come from a generator (Termly recommended) or a solicitor. Claude Code will insert clearly-marked `// TODO: legal copy from Termly/solicitor` blocks at every spot real text is needed. Do not invent legal copy.

---

## 2. Phasing

Implement in two passes if needed, single PR if not:

**Pass A — Structural (must ship together):**
- Footer rebuild
- Legal page routes + cookie consent banner
- Service page routes (scaffold)
- About page
- Hero tile decision (testimonial OR removal)

**Pass B — Content fill (can iterate):**
- Service page content (industries, use cases, expanded copy)
- Schema markup
- Cal.com/Calendly integration
- Journal decision

Both passes use the same branch and stack into one PR if the work fits one session. Otherwise, split.

---

## 3. Hero — Recently Shipped tile decision

User-confirmed decision required before implementation. Two options. Implement whichever the user specifies in their kickoff message:

### Option A — Replace with testimonial card (preferred if quote available)

In `app/_components/RecentlyShipped.tsx` (or rename to `TestimonialCard.tsx`):

- Same browser-chrome design (red/amber/green dots, monospace URL, "↗ View live" link)
- Inside the card: a serif pull-quote of 2–3 sentences from the Potter Sanctuary owner
- Below the chrome card: small attribution block (Name, Role, Business)
- Live site link stays in the chrome bar

Caption beneath:
```
Recently shipped
The Potter Sanctuary — brand + booking system
4 weeks · end-to-end · 1 person
```

The user will paste the testimonial quote at kickoff. Until provided, use a clearly-marked placeholder:
```
"[TESTIMONIAL QUOTE — awaiting from Potter Sanctuary owner. 2–3 sentences about working with KP, the result, or both.]"
— [Name], [Role], The Potter Sanctuary
```

### Option B — Remove tile, single-column hero

If the user opts to remove rather than replace:

- Delete `RecentlyShipped.tsx` entirely (no other consumers per Phase 1 dead-code check)
- Remove the import and render from `Hero.tsx`
- Adjust `Hero.tsx` grid: convert two-column to single-column with hero text centered or left-aligned (designer's call within the existing type system)
- Maintain the same overall hero height so the page doesn't shift unexpectedly
- The hero should still feel intentional and confident — don't leave dead space; let the typography breathe

---

## 4. Footer — full functional rebuild

**File:** `app/_components/Footer.tsx`

Currently the footer is static text with no working links. Rebuild as a fully functional footer with the following structure:

### Layout

Four columns on desktop, stacking to single column on mobile (use existing breakpoint conventions):

1. **Brand column** — KP Solutions wordmark, tagline (existing copy preserved), small social row (LinkedIn, X/Twitter, GitHub — placeholders OK if accounts don't exist yet, wrapped in conditional render)
2. **What we build** — Each pillar links to its dedicated service page (see §6)
3. **Company** — Selected work, Process, About, Journal (or remove Journal — see §11), Contact
4. **Contact** — Email (mailto:), Phone (tel:), Book a call (anchors to #contact, or external Cal.com URL if user provides one)

### Footer bottom row

- Left: © 2026 KP Solutions Ltd. · Registered in England & Wales · Company No. [TODO: company number]
- Right: Privacy · Terms · Cookies (each linking to their dedicated page — see §5)
- Remove "Status" link unless a status page is planned (see §11)

### Link specifications

All footer items must be functional links, not styled text:

```js
const footerLinks = {
  whatWeBuild: [
    { label: "Custom Platforms", href: "/services/custom-platforms" },
    { label: "Mobile Applications", href: "/services/mobile-applications" },
    { label: "Integrations & Automation", href: "/services/integrations-automation" },
    { label: "Modernization & Replacement", href: "/services/modernization" },
  ],
  company: [
    { label: "Selected work", href: "/#work" },
    { label: "Process", href: "/#process" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/#contact" },
    // { label: "Journal", href: "/journal" }, // Re-enable when journal exists
  ],
  contact: [
    { label: "sales@kpsolutions.io", href: "mailto:sales@kpsolutions.io" },
    { label: "+44 7597 735 812", href: "tel:+447597735812" },
    { label: "Book a call", href: "/#contact" }, // Or Cal.com URL
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Cookies", href: "/cookies" },
  ],
};
```

### Styling

- Reuse existing footer typography, spacing, and rule lines
- Hover state on links: subtle underline or opacity change (match existing convention in the site)
- Mobile: collapse to single column, generous vertical spacing between sections
- Keep the existing border-top divider above the bottom row

---

## 5. Legal pages — scaffolded routes with placeholder copy

Create three new pages using Next.js App Router conventions:

- `app/privacy/page.tsx` → `/privacy`
- `app/terms/page.tsx` → `/terms`
- `app/cookies/page.tsx` → `/cookies`

### Shared layout

Create `app/_components/LegalPageLayout.tsx` to wrap all three legal pages with consistent treatment:

- Same nav and footer as the main site
- Editorial serif H1
- `max-width: 800px` content column, generous line-height
- Last-updated date prominently displayed
- Table of contents at top (anchor links to each section)
- Body text in a readable, slightly larger size than the homepage body copy

### Page structure for each

Each page receives a clearly-marked placeholder structure:

```jsx
// app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="[TODO: insert date when policy is finalised]">
      {/* TODO: Replace all content below with finalised privacy policy.
          Source: Termly (termly.io) or solicitor-drafted.
          Must comply with UK GDPR and PECR.
          The structure below is a placeholder skeleton, NOT legal text. */}

      <section id="who-we-are">
        <h2>Who we are</h2>
        <p>[TODO: Company name, address, registration number, data controller details]</p>
      </section>

      <section id="what-we-collect">
        <h2>What information we collect</h2>
        <p>[TODO: Personal data collected via contact form, analytics, cookies, etc.]</p>
      </section>

      <section id="how-we-use-it">
        <h2>How we use your information</h2>
        <p>[TODO: Lawful basis, purposes of processing]</p>
      </section>

      <section id="sharing">
        <h2>Who we share it with</h2>
        <p>[TODO: Third parties — hosting, email, analytics, payment processors]</p>
      </section>

      <section id="retention">
        <h2>How long we keep it</h2>
        <p>[TODO: Retention periods per data category]</p>
      </section>

      <section id="rights">
        <h2>Your rights</h2>
        <p>[TODO: UK GDPR data subject rights — access, rectification, erasure, portability, objection]</p>
      </section>

      <section id="contact">
        <h2>Contact us about your data</h2>
        <p>[TODO: DPO/contact email, ICO complaint right]</p>
      </section>
    </LegalPageLayout>
  );
}
```

### Terms of service — same pattern

Structural sections:
- Introduction & acceptance
- Services we provide
- Engagement & quotes
- Payment terms
- Intellectual property (you own the code from day one — this is a real KP commitment)
- Confidentiality
- Warranties & disclaimers
- Limitation of liability
- Termination
- Governing law (England & Wales)
- Changes to these terms
- Contact

### Cookie policy — same pattern

Structural sections:
- What cookies are
- Cookies we use (categorised: strictly necessary, analytics, marketing)
- Third-party cookies (Vercel, analytics provider, etc.)
- How to manage cookies (browser settings, our consent banner)
- Updates to this policy
- Contact

**Critical:** every paragraph of actual legal content must be wrapped in a `// TODO` comment marker so it's impossible to ship placeholder text accidentally. A pre-launch check should grep for `[TODO:` and fail if any remain.

---

## 6. Cookie consent banner

Create `app/_components/CookieConsent.tsx` and integrate at the layout level (`app/layout.tsx` or equivalent root).

### Requirements

- **Compliant with UK GDPR + PECR:** banner must appear on first visit, must offer "Accept all" + "Reject all" + "Manage preferences" (not just an OK button)
- **No cookies set before consent** (this is the critical legal point — analytics scripts must be deferred until consent is given)
- **Granular categories:** Strictly Necessary (always on, can't be disabled), Analytics, Marketing
- **Consent stored** in `localStorage` (not in a cookie itself, to avoid the recursion)
- **Reset mechanism:** a "Manage cookie preferences" link in the footer that re-opens the banner

### Implementation notes

- Place banner at bottom of viewport, slide-up animation respecting `prefers-reduced-motion`
- Style consistent with site: serif copy, lime accent on primary action, sufficient contrast for WCAG AA
- "Manage preferences" expands inline to show category toggles
- On accept/reject, store decision and timestamp in localStorage with version key (so policy updates can re-prompt)

### Recommended library

Either build from scratch (preferred for control and design fit) or use `react-cookie-consent` if Claude Code judges the time saving is worth the styling work. Default to custom build to match the design system precisely.

---

## 7. Service pages — four dedicated routes

Create four new pages, one per pillar:

- `app/services/custom-platforms/page.tsx` → `/services/custom-platforms`
- `app/services/mobile-applications/page.tsx` → `/services/mobile-applications`
- `app/services/integrations-automation/page.tsx` → `/services/integrations-automation`
- `app/services/modernization/page.tsx` → `/services/modernization`

### Shared structure for each service page

Reuse the homepage design system. Each page contains, in order:

1. **Hero section** — eyebrow `Services / [Pillar name]`, large serif headline, descriptive subhead
2. **Long-form description** — 2–3 paragraphs expanding what the homepage pillar says
3. **Who this is for** — bulleted list of buyer profiles
4. **Industries we work with** — see industry list below; each page calls out 3–5 most relevant industries
5. **What we typically build** — concrete examples of features/components
6. **Selected work** (if applicable) — case study tile when one exists for the pillar
7. **Process** — short version, with link back to homepage `/#process` for full process
8. **CTA** — "Start a project" button anchoring to `/#contact`

### Industries — master list

Use this canonical list across all service pages. Each service page picks 3–5 most relevant:

- **Wellness, beauty & aesthetics** (booking-led, Potter Sanctuary fits here)
- **Hospitality, food & drink** (multi-site ops, reservations, EPOS adjacencies)
- **Field services** (cleaning, trades, maintenance — geofenced T&A, scheduling)
- **Multi-site retail** (operations across locations, stock, reporting)
- **Professional services** (legal, accountancy, consulting — client portals, time tracking)
- **Education & training** (course booking, certifications, LMS-adjacent)
- **Membership & community** (gyms, clubs, subscription-based)

### Per-page industry mapping (suggested defaults)

- **Custom Platforms:** Wellness/beauty, Hospitality, Multi-site retail, Professional services, Membership
- **Mobile Applications:** Field services, Wellness/beauty (customer-facing booking), Hospitality (staff ops), Multi-site retail
- **Integrations & Automation:** Professional services, Multi-site retail, Hospitality, Education
- **Modernization:** Professional services, Field services, Multi-site retail, Hospitality

### Per-page copy

Detailed copy for each service page is too much for this brief — instruct Claude Code to **draft the copy in plan mode** and check in with the user before applying. Draft should:

- Be 600–900 words per page
- Use the same editorial serif voice as the homepage
- Reference real capabilities (booking systems, geofenced check-ins, etc.) — no aspirational fluff
- End each section with concrete examples, not abstract claims

---

## 8. About page

Create `app/about/page.tsx` → `/about`

**Structural sections** (copy to be drafted by Claude Code in plan mode, user approves before applying):

1. **Hero:** "One person, end to end. Here's who."
2. **Founder photo and short bio** — user will provide photo; bio drafted from "one person who designs, builds, and delivers everything" angle
3. **Why KP Solutions exists** — short story about the gap in the market (off-the-shelf doesn't fit; agencies cost too much; in-house dev is overkill)
4. **How we work** — short version of the four-week build, linked to homepage `/#process`
5. **What we don't do** — be explicit about scope (no SEO retainers, no growth marketing, no AI sticker projects)
6. **Get in touch** — CTA to contact form

Founder name and bio: user to provide at kickoff. Until provided, use clearly-marked placeholder.

---

## 9. Nav updates

**File:** `app/_components/Nav.tsx`

Add **About** link. Final nav order:

```
What we build → /#services
Work → /#work
Process → /#process
About → /about
[Start a project] → /#contact
```

Keep the existing anchor behaviour for homepage sections; add proper page links for `/about`.

**Mobile nav:** if a hamburger menu exists, mirror the same structure. If no mobile nav exists currently, this is out of scope for this phase (flag as a follow-up).

---

## 10. Small wins

### 10a. Schema markup

In `app/layout.tsx`, add JSON-LD structured data for the Organization:

```jsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "KP Solutions",
      "url": "https://kpsolutions.io",
      "logo": "https://kpsolutions.io/[TODO: logo path]",
      "email": "sales@kpsolutions.io",
      "telephone": "+44-7597-735-812",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "GB"
      },
      "sameAs": [
        // TODO: social URLs when accounts exist
      ]
    })
  }}
/>
```

### 10b. Cal.com or Calendly link

If the user provides a booking URL at kickoff, replace the "Book a call" footer link href with that URL (and make it `target="_blank" rel="noopener noreferrer"`). Otherwise, leave it pointing at `/#contact` and flag as a follow-up.

### 10c. Sitemap

Add or update `app/sitemap.ts` (Next.js App Router convention) to list all new routes: `/`, `/about`, `/privacy`, `/terms`, `/cookies`, and the four `/services/*` routes.

### 10d. robots.txt

Confirm `app/robots.ts` exists and allows indexing of public routes. Update if missing.

---

## 11. Decisions to confirm with user at kickoff

Before starting implementation, Claude Code must surface these and get user input:

- [ ] Hero tile: Option A (testimonial) or Option B (removal)?
- [ ] Testimonial quote text + attribution (if Option A)
- [ ] Founder name, bio, and photo path for About page
- [ ] Cal.com/Calendly booking URL (or skip for now)
- [ ] Journal: build a `/journal` route now, or remove footer link?
- [ ] Status page: build, or remove footer link?
- [ ] Company registration number for footer bottom row
- [ ] Social account URLs (LinkedIn, X, GitHub) — provide or skip

---

## 12. Critical files

**Create:**
- `app/_components/LegalPageLayout.tsx`
- `app/_components/CookieConsent.tsx`
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `app/cookies/page.tsx`
- `app/services/custom-platforms/page.tsx`
- `app/services/mobile-applications/page.tsx`
- `app/services/integrations-automation/page.tsx`
- `app/services/modernization/page.tsx`
- `app/about/page.tsx`
- `app/sitemap.ts` (if missing)
- `app/robots.ts` (if missing)

**Modify:**
- `app/_components/Footer.tsx` — full rebuild
- `app/_components/Nav.tsx` — add About link
- `app/_components/Hero.tsx` — hero tile decision (Option A or B)
- `app/layout.tsx` — schema markup + cookie consent integration

**Delete (only if Option B for hero):**
- `app/_components/RecentlyShipped.tsx`

---

## 13. Reuse patterns

- Reuse `1fr 2fr` grid, `.eyebrow` class, `serif` class, `clamp()` typography, and lime accent across all new pages
- Service pages share structural conventions with the homepage's What We Build section
- Legal pages share LegalPageLayout
- Cookie banner uses site colour tokens (no new colours introduced)
- No new dependencies unless the user explicitly approves

---

## 14. Commit plan

Branch: `claude/phase-2-finishing-touches`. Per-commit:

1. `feat(footer): rebuild with functional links and four-column layout`
2. `feat(legal): scaffold privacy, terms, cookies pages with placeholder structure`
3. `feat(consent): add cookie consent banner with category toggles`
4. `feat(services): scaffold four service pages with shared structure`
5. `feat(services): draft copy and industries-served sections` (after user approval)
6. `feat(about): add /about page` (after user approves founder bio)
7. `feat(hero): [Option A: replace tile with testimonial card] OR [Option B: remove tile, single-column hero]`
8. `feat(nav): add About link`
9. `feat(seo): add schema markup, sitemap, robots`

Each commit independently reviewable. Push to remote after each so the user can preview in the deployed PR.

---

## 15. Verification (before declaring done)

1. **Build:** `npm run build` succeeds, TypeScript passes.
2. **Routes:** every new route resolves to a page, no 404s. Test `/privacy`, `/terms`, `/cookies`, `/about`, and all four `/services/*` routes.
3. **Footer link sweep:** every footer link works. mailto opens email client, tel opens dialer, internal anchors scroll correctly, page links navigate without 404.
4. **Cookie banner:** appears on first visit, dismissible, choice persists in localStorage, "Manage preferences" in footer re-opens it. No analytics fires before consent.
5. **Placeholder sweep:** grep for `[TODO:` across the codebase. Every match should be intentional and known. Legal pages should still have TODOs in them; they ship as scaffolding.
6. **Schema markup:** validate at https://search.google.com/test/rich-results with the homepage URL after deploy.
7. **Visual review:** new pages render correctly at desktop and mobile breakpoints. Footer collapses cleanly on mobile.
8. **Reduced motion:** cookie banner animation respects `prefers-reduced-motion: reduce`.
9. **Accessibility quick check:** new pages have proper heading hierarchy (single H1, logical H2/H3), all interactive elements keyboard-accessible, link text descriptive (not "click here").

---

## 16. Acceptance criteria

- [ ] Footer is fully functional — every link works, no static text masquerading as links
- [ ] `/privacy`, `/terms`, `/cookies` pages exist, route correctly, and clearly mark all placeholder content with TODOs
- [ ] Cookie consent banner appears, persists choice, gates analytics
- [ ] Four service pages exist with consistent structure, industries-served sections, and pillar-specific copy
- [ ] About page exists with placeholder for founder name/bio/photo until user provides
- [ ] Nav includes About link
- [ ] Hero tile decision applied per user's choice at kickoff
- [ ] Schema markup, sitemap, robots in place
- [ ] No broken links anywhere on the site
- [ ] All TODO markers documented and intentional
