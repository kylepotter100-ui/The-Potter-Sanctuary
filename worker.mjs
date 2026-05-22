// Custom Cloudflare Worker entry that wraps the OpenNext-generated handler
// and adds a `scheduled` event handler so cron triggers (registered in
// wrangler.jsonc) actually fire our /api/cron/* routes.
//
// At deploy time `opennextjs-cloudflare build` produces .open-next/worker.js;
// wrangler bundles this file together with that one. The file is plain JS
// rather than TypeScript so `npm run build` (Next.js typecheck) doesn't try
// to resolve the .open-next import (which doesn't exist before the OpenNext
// build runs).

import openNextHandler from "./.open-next/worker.js";

// Routes that run every hour, regardless of UK time. The review-requests
// route is feature-flagged off internally (REVIEWS_ENABLED) until launch,
// so it's safe to dispatch hourly now.
const HOURLY_ROUTES = [
  "/api/cron/reminders",
  "/api/cron/appointment-reminders",
  "/api/cron/review-requests",
];

// Returns the current hour in Europe/London (handles BST/GMT correctly).
function ukHour() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  });
  const part = fmt.formatToParts(new Date()).find((p) => p.type === "hour");
  return parseInt(part?.value ?? "-1", 10);
}

export default {
  // Delegate ALL HTTP requests to OpenNext's handler. Call it as a method
  // of openNextHandler (not a detached reference) so `this` stays bound —
  // OpenNext relies on that to route requests, including serving static
  // assets from /public (e.g. /sanctuary-logo.png, /favicon.ico) via the
  // ASSETS binding. A bare `fetch: openNextHandler.fetch` loses `this` and
  // breaks static-asset serving.
  fetch(request, env, ctx) {
    return openNextHandler.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    const work = (async () => {
      const secret = env.CRON_SECRET;
      if (!secret) {
        console.error(
          "[scheduled] CRON_SECRET missing — cron routes won't run"
        );
        return;
      }
      const baseUrl =
        env.NEXT_PUBLIC_SITE_URL || "https://www.thepottersanctuary.co.uk";
      const headers = { Authorization: `Bearer ${secret}` };
      const binding = env.WORKER_SELF_REFERENCE;
      if (!binding || typeof binding.fetch !== "function") {
        console.error(
          "[scheduled] WORKER_SELF_REFERENCE binding missing — cron routes can't run"
        );
        return;
      }

      // Build the dispatch list. Hourly jobs always run; the morning
      // summary only runs in the 6/7/8 UK hours so a single hourly cron
      // can drive it without 21 wasted invocations per day. The window
      // is wider than the 7am-only check inside the route so we still
      // hit the 7am bucket even if Cloudflare drifts the trigger.
      const routes = [...HOURLY_ROUTES];
      const hour = ukHour();
      if (hour >= 6 && hour <= 8) {
        routes.push("/api/cron/morning-summary");
      }

      const results = await Promise.allSettled(
        routes.map((path) =>
          binding.fetch(`${baseUrl}${path}`, { headers })
        )
      );
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(
            `[scheduled] ${routes[i]} failed`,
            JSON.stringify(r.reason, Object.getOwnPropertyNames(r.reason || {}))
          );
        } else if (!r.value.ok) {
          console.error(`[scheduled] ${routes[i]} ${r.value.status}`);
        }
      });
    })();
    ctx.waitUntil(work);
  },
};
