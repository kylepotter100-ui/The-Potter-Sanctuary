import type { Metadata } from "next";
import SageBrandedHeader from "@/components/SageBrandedHeader";
import UnsubscribeButton from "@/components/UnsubscribeButton";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ t?: string }>;

// A button rather than unsubscribing on page load: link scanners and email
// security tools open links automatically and would otherwise unsubscribe
// people who never asked to.
export default async function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const { t } = await searchParams;
  return (
    <>
      <SageBrandedHeader />
      <main className="review-page">
        <div className="review-shell">
          <h1>Unsubscribe</h1>
          <p className="review-lede">
            Stop occasional offers and &ldquo;time for your next treatment&rdquo;
            reminders? You&apos;ll still get emails about bookings you make.
          </p>
          <UnsubscribeButton token={t ?? ""} />
        </div>
      </main>
    </>
  );
}
