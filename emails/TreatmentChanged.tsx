import { Section } from "@react-email/components";
import {
  BONE,
  ContentSection,
  CtaButton,
  DetailRow,
  Divider,
  EmailLayout,
  INK_SOFT,
  LINE,
  Paragraph,
  SectionHeading,
} from "./_shared";

type Props = {
  firstName: string;
  treatmentName: string; // new
  treatmentPrice: number; // new, pounds
  bookingDate: string; // long date (new)
  bookingTime: string; // 12h (new)
  previousTreatmentName: string;
  previousPrice: number;
  previousDate: string;
  previousTime: string;
  /** True when the appointment also moved, not just the treatment. */
  moved: boolean;
  siteUrl: string;
  // Set when the booking was paid with a gift voucher. Absent for cash
  // bookings, so those emails are byte-identical to before.
  voucherCode?: string | null;
};

export default function TreatmentChanged({
  firstName,
  treatmentName,
  treatmentPrice,
  bookingDate,
  bookingTime,
  previousTreatmentName,
  previousPrice,
  previousDate,
  previousTime,
  moved,
  siteUrl,
  voucherCode = null,
}: Props) {
  const manageUrl = `${siteUrl}/login?next=/account`;
  // The old booking, shown so the change is unmistakable — the price moved, and
  // payment is taken in cash on the day, so the client must not be surprised.
  const previously = `${previousTreatmentName} · £${previousPrice}`;
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Your booking is now ${treatmentName} on ${bookingDate} at ${bookingTime}`}
    >
      <ContentSection>
        <SectionHeading>Your booking has been updated</SectionHeading>
        <Paragraph>
          Hello {firstName} — your treatment has been changed. Here are your
          updated details:
        </Paragraph>

        <Section
          style={{
            background: BONE,
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            padding: "20px 22px",
            margin: "8px 0 4px",
          }}
        >
          <DetailRow label="Treatment" value={treatmentName} />
          <DetailRow label="Date" value={bookingDate} />
          <DetailRow label="Time" value={bookingTime} />
          <DetailRow label="Price" value={`£${treatmentPrice}`} />
          <DetailRow
            label="Previously"
            value={
              moved
                ? `${previously}, ${previousDate} at ${previousTime}`
                : previously
            }
          />
          <DetailRow
            label="Location"
            value="22 Lockheed Close, Beck Row, IP28 3AB"
            last
          />
        </Section>

        <Divider />
        <SectionHeading>Payment</SectionHeading>
        <Paragraph>
          {/* Deliberately hedged: moving a voucher-funded booking to a dearer
              treatment means the voucher no longer covers it. Promising
              "nothing to pay" would be wrong; demanding cash would be too. */}
          {voucherCode
            ? `This booking is paid with gift voucher ${voucherCode}. If the new treatment differs in price, we'll confirm anything outstanding with you directly.`
            : "Payment is taken in cash directly after your treatment at the studio. We do not accept card or electronic payments at this time."}
        </Paragraph>

        <Divider />
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: INK_SOFT,
            margin: "0 0 4px",
          }}
        >
          If this doesn&apos;t look right, just reply to this email and we&apos;ll
          put it straight. You can also view your booking any time in your
          account.
        </p>
        <CtaButton href={manageUrl} label="View my booking" />

        <p
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 17,
            fontStyle: "italic",
            margin: 0,
          }}
        >
          With warmth,
          <br />
          The Potter Sanctuary
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
