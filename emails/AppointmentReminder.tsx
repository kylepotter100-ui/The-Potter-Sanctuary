import { Section } from "@react-email/components";
import {
  ContentSection,
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
            value="The Potter Sanctuary, Beck Row, Suffolk"
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
          Need to cancel? Sign in to your account or reply to this email — we
          ask for at least 12 hours notice as a courtesy.
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
