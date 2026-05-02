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
};

export default function ConsultationReminder({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  bookingId,
  siteUrl,
}: Props) {
  const consultationUrl = `${siteUrl}/questionnaire?booking=${encodeURIComponent(
    bookingId
  )}`;

  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Friendly reminder — please complete your consultation before ${bookingDate}`}
    >
      <ContentSection>
        <SectionHeading>A friendly reminder</SectionHeading>
        <Paragraph>
          Dear {firstName}, your appointment with The Potter Sanctuary is
          approaching. To ensure your treatment can go ahead as planned, please
          complete your consultation questionnaire as soon as possible.
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
          label="Complete Your Questionnaire"
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
          Without a completed questionnaire, your treatment may not be able to
          commence.
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
