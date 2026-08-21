import { Section } from "@react-email/components";
import {
  ContentSection,
  DetailRow,
  Divider,
  EmailLayout,
  INK,
  Paragraph,
  SectionHeading,
  SERIF,
  BONE,
  LINE,
} from "./_shared";

type Props = {
  firstName: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  treatmentPrice: number;
  siteUrl: string;
  // Set when the booking was paid with a gift voucher. Absent for cash
  // bookings, so those emails are byte-identical to before.
  voucherCode?: string | null;
};

export default function BookingConfirmed({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  treatmentPrice,
  siteUrl,
  voucherCode = null,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Your booking is confirmed — ${bookingDate} at ${bookingTime}`}
    >
      <ContentSection>
        <SectionHeading>Dear {firstName},</SectionHeading>
        <Paragraph>
          Wonderful news — your session at The Potter Sanctuary is now
          confirmed. We&apos;ve set this time aside for you and look forward to
          welcoming you in.
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
          <DetailRow label="Cost" value={`£${treatmentPrice}`} />
          {/* Cost stays the LIST PRICE; this row says it is already paid. */}
          {voucherCode ? (
            <DetailRow label="Paid with" value={`Gift voucher ${voucherCode}`} />
          ) : null}
          <DetailRow
            label="Location"
            value="22 Lockheed Close, Beck Row, IP28 3AB"
            last
          />
        </Section>

        <Divider />
        <SectionHeading>Payment</SectionHeading>
        <Paragraph>
          {voucherCode
            ? `Paid in full with gift voucher ${voucherCode} — there's nothing to pay at the studio.`
            : "Payment is taken in cash directly after your treatment at the studio. We do not accept card or electronic payments at this time."}
        </Paragraph>

        <Divider />
        <p
          style={{
            fontFamily: SERIF,
            fontSize: 17,
            fontStyle: "italic",
            color: INK,
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
