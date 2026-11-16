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
  AppointmentExtras,
  type EmailCalendar,
  STUDIO_ADDRESS,
} from "./_shared";

type Props = {
  /** Calendar links + directions; the .ics is attached by the sender. */
  calendar?: EmailCalendar | null;
  firstName: string;
  treatmentName: string;
  bookingDate: string; // new date (long)
  bookingTime: string; // new time (12h)
  previousDate: string;
  previousTime: string;
  siteUrl: string;
};

export default function RescheduleConfirmation({
  calendar = null,
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  previousDate,
  previousTime,
  siteUrl,
}: Props) {
  const manageUrl = `${siteUrl}/login?next=/account`;
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Your appointment has been rescheduled to ${bookingDate} at ${bookingTime}`}
    >
      <ContentSection>
        <SectionHeading>Your appointment has been rescheduled</SectionHeading>
        <Paragraph>
          All done, {firstName} — your booking has been moved. Here are your new
          details:
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
          <DetailRow label="New date" value={bookingDate} />
          <DetailRow label="New time" value={bookingTime} />
          <DetailRow
            label="Previously"
            value={`${previousDate} at ${previousTime}`}
          />
          <DetailRow
            label="Location"
            value={STUDIO_ADDRESS}
            last
          />
        </Section>
        <AppointmentExtras calendar={calendar} />

        <Divider />
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: INK_SOFT,
            margin: "0 0 4px",
          }}
        >
          Need to change it again? You can reschedule or cancel any time in your
          account.
        </p>
        <CtaButton
          href={manageUrl}
          label="Manage / Reschedule / Cancel"
        />
      </ContentSection>
    </EmailLayout>
  );
}
