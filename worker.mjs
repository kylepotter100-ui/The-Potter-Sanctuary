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

const HOURLY_ROUTES = [
  "/api/cron/reminders",
  "/api/cron/appointment-reminders",
  // morning-summary is HTTP-callable hourly too — the route checks the UK
  // hour itself and bails outside the 7am window. Keeping the gate inside
  // the route avoids double sources of truth on timezone handling.
  "/api/cron/morning-summary",
];

export default {
  fetch: openNextHandler.fetch,
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

      const results = await Promise.allSettled(
        HOURLY_ROUTES.map((path) =>
          binding.fetch(`${baseUrl}${path}`, { headers })
        )
      );
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(
            `[scheduled] ${HOURLY_ROUTES[i]} failed`,
            JSON.stringify(r.reason, Object.getOwnPropertyNames(r.reason || {}))
          );
        } else if (!r.value.ok) {
          console.error(
            `[scheduled] ${HOURLY_ROUTES[i]} ${r.value.status}`
          );
        }
      });
    })();
    ctx.waitUntil(work);
  },
};
