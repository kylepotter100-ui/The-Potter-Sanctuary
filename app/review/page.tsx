import type { Metadata } from "next";
import SageBrandedHeader from "@/components/SageBrandedHeader";
import ReviewForm from "@/components/ReviewForm";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Share your feedback — The Potter Sanctuary",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ booking?: string }>;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const bookingId = params.booking ?? null;

  let valid = false;
  if (bookingId && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id, review_email_sent_at")
      .eq("id", bookingId)
      .maybeSingle();
    // Only show the form for bookings we've actually emailed a request for.
    valid = !!data && !!data.review_email_sent_at;
  }

  return (
    <>
      <SageBrandedHeader />
      <main className="review-page">
        <div className="review-shell">
          {valid && bookingId ? (
            <>
              <h1>How was your session?</h1>
              <p className="review-lede">
                We hope you feel restored. Your feedback means a great deal to
                us.
              </p>
              <ReviewForm bookingId={bookingId} />
            </>
          ) : (
            <>
              <h1>This review link isn&apos;t valid</h1>
              <p className="review-lede">
                The link may have expired or already been used. If you&apos;d
                like to share feedback, simply reply to your confirmation
                email or contact us at hello@thepottersanctuary.co.uk.
              </p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
