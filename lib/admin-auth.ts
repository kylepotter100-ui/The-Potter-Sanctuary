import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionSecret,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

// Server-side admin gate shared by every /api/admin/* route and every admin
// page. Middleware is the first gate; this is the second, so a middleware
// bypass (e.g. a framework caching bug) still cannot reach admin data.

/** True when the request carries a valid, unexpired, signed admin session. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSessionToken(
    adminSessionSecret(),
    store.get(ADMIN_SESSION_COOKIE)?.value
  );
}

/** For admin server components: bounce to the login page unless signed in. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin?reason=expired");
}
