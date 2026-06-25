import { Section } from "@react-email/components";
import {
  ContentSection,
  CtaButton,
  DetailRow,
  Divider,
  EmailLayout,
  INK_SOFT,
  Paragraph,
  SectionHeading,
  BONE,
  LINE,
} from "./_shared";

type Props = {
  firstName: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  siteUrl: string;
};

export default function AppointmentReminder({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  siteUrl,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`See you tomorrow at ${bookingTime} — ${treatmentName}`}
    >
      <ContentSection>
        <SectionHeading>Looking forward to seeing you tomorrow</SectionHeading>
        <Paragraph>
          Dear {firstName}, just a friendly reminder that your appointment at
          The Potter Sanctuary is tomorrow.
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
          <DetailRow
            label="Location"
            value="22 Lockheed Close, Beck Row, IP28 3AB"
            last
          />
        </Section>

        <Divider />
        <SectionHeading>Helpful info</SectionHeading>
        <Paragraph>
          Please arrive 5 minutes before your appointment to settle in. Wear
          comfortable clothing — you may want to remove jewellery before your
          session.
        </Paragraph>

        <Divider />
        <SectionHeading>Payment</SectionHeading>
        <Paragraph>
          Payment is taken in cash directly after your treatment.
        </Paragraph>

        <Divider />
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: INK_SOFT,
            margin: 0,
          }}
        >
          Need to change or cancel? Reschedule or cancel any time in your
          account — we ask for at least 12 hours notice as a courtesy.
        </p>
        <CtaButton
          href={`${siteUrl}/login?next=/account`}
          label="Manage / Reschedule / Cancel"
        />
      </ContentSection>
    </EmailLayout>
  );
}
