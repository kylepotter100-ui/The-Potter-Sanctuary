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
  bookingId: string;
  siteUrl: string;
  // Returning client (has a consultation on file): the form is pre-filled, so
  // the ask is to review & confirm rather than complete from scratch.
  returning?: boolean;
};

export default function ConsultationReminder({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  bookingId,
  siteUrl,
  returning = false,
}: Props) {
  const consultationUrl = `${siteUrl}/questionnaire?booking=${encodeURIComponent(
    bookingId
  )}`;

  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={
        returning
          ? `Friendly reminder — please review and confirm your details before ${bookingDate}`
          : `Friendly reminder — please complete your consultation before ${bookingDate}`
      }
    >
      <ContentSection>
        <SectionHeading>A friendly reminder</SectionHeading>
        <Paragraph>
          {returning
            ? `Dear ${firstName}, your appointment with The Potter Sanctuary is approaching. We still have your consultation details from your last visit — please take a moment to review and confirm they're still current (and update anything that has changed) before your session.`
            : `Dear ${firstName}, your appointment with The Potter Sanctuary is approaching. To ensure your treatment can go ahead as planned, please complete your consultation questionnaire as soon as possible.`}
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
          <DetailRow label="Time" value={bookingTime} last />
        </Section>

        <CtaButton
          href={consultationUrl}
          label={returning ? "Review & Confirm Your Details" : "Complete Your Questionnaire"}
        />

        <Divider />
        <p
          style={{
            fontSize: 13,
            fontStyle: "italic",
            lineHeight: 1.6,
            color: INK_SOFT,
            margin: 0,
          }}
        >
          {returning
            ? "Confirming your details helps us tailor your treatment safely."
            : "Without a completed questionnaire, your treatment may not be able to commence."}
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
