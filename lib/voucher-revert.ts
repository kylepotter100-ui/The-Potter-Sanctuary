import type { SupabaseClient } from "@supabase/supabase-js";

// Returning a voucher to `active` after the booking it funded is cancelled,
// so the client can rebook with the same code.
//
// THE INVARIANT this relies on: a voucher's status strictly alternates
//   active --(claim)--> redeemed --(revert)--> active --> ...
// and a LIVE (pending/confirmed) booking referencing voucher V implies V is
// redeemed. Every writer is a conditional update, so each transition has
// exactly one winner:
//
//   - claim  (public booking path, and the admin manual redeem route)
//        ... .eq("status", "active")     -- requires active
//   - revert (this function, and release-on-failed-booking)
//        ... .eq("status", "redeemed")   -- requires redeemed
//
// WHY THIS CANNOT CLOBBER SOMEONE ELSE'S REDEMPTION: to reach here, the caller
// must have just won a booking's cancel transition (`.neq("status",
// "cancelled")`), which fires at most once per booking. The partial unique
// index `bookings_voucher_active_unique` caps live voucher-funded bookings at
// one per voucher, so that winning cancel corresponds to exactly one
// redemption era. A second, unrelated redemption of the same voucher can only
// begin AFTER this revert has committed — by which point this call has already
// consumed its era and cannot fire again.
//
// ORDERING IS LOAD-BEARING: callers must cancel the booking FIRST and revert
// SECOND. Reverting first would open a window where the voucher is `active`
// while its booking is still live, letting the same code fund a second booking.
//
// ⚠️ FUTURE RISK: adding an admin "un-redeem" route would break the argument
// above, because it would introduce a `redeemed -> active` transition that is
// NOT gated by a cancellation. If that is ever added, this reasoning must be
// revisited — most likely by conditioning the revert on the booking id too.

/**
 * Return a redeemed voucher to `active`. Conditional on the voucher still being
 * `redeemed`, so a concurrent writer can never be clobbered.
 *
 * Best-effort by design: never throws and returns nothing. Cancelling a booking
 * must succeed for the customer even if the voucher write fails — a stuck
 * `redeemed` voucher is recoverable by hand (the owner can see it on the
 * voucher detail page), whereas a failed cancellation is not.
 */
export async function revertVoucherRedemption(
  admin: SupabaseClient,
  voucherId: string
): Promise<void> {
  try {
    const { data: rows, error } = await admin
      .from("vouchers")
      .update({ status: "active", redeemed_at: null })
      .eq("id", voucherId)
      .eq("status", "redeemed")
      .select("id");

    if (error) {
      console.error(
        "[voucher-revert] update failed — voucher left redeemed",
        JSON.stringify({ voucherId, error })
      );
      return;
    }
    if (!rows || rows.length === 0) {
      // Unexpected under the invariant above: we only get here after winning a
      // cancel transition on a booking that links this voucher, so it should
      // have been 'redeemed'. Worth investigating if it ever appears — most
      // likely a manual status edit in the dashboard.
      console.error(
        "[voucher-revert] no row reverted (unexpected — voucher was not 'redeemed')",
        JSON.stringify({ voucherId })
      );
    }
  } catch (err) {
    console.error(
      "[voucher-revert] unexpected failure",
      JSON.stringify({ voucherId, error: String(err) })
    );
  }
}
