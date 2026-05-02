import { Section } from "@react-email/components";
import {
  ContentSection,
  DetailRow,
  Divider,
  EmailLayout,
  INK,
  INK_SOFT,
  Paragraph,
  SectionHeading,
  BONE,
  LINE,
} from "./_shared";

type Props = {
  firstName: string;
  lastName: string;
  phone: string;
  customerEmail: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  treatmentPrice: number;
  gender: string;
  message: string;
  timestamp: string;
  siteUrl: string;
};

export default function OwnerNotification({
  firstName,
  lastName,
  phone,
  customerEmail,
  treatmentName,
  bookingDate,
  bookingTime,
  treatmentPrice,
  gender,
  message,
  timestamp,
  siteUrl,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`New booking — ${firstName} ${lastName} — ${bookingDate}`}
    >
      <ContentSection>
        <SectionHeading>New booking received</SectionHeading>
        <Paragraph>
          {firstName} {lastName} has booked a session.
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
          <DetailRow label="Name" value={`${firstName} ${lastName}`} />
          <DetailRow label="Email" value={customerEmail} />
          <DetailRow label="Phone" value={phone} />
          <DetailRow label="Gender" value={gender} />
          <DetailRow label="Treatment" value={treatmentName} />
          <DetailRow label="Date" value={bookingDate} />
          <DetailRow label="Time" value={bookingTime} />
          <DetailRow label="Cost" value={`£${treatmentPrice}`} last />
        </Section>

        {message && message.trim().length > 0 ? (
          <>
            <Divider />
            <SectionHeading>Customer message</SectionHeading>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: INK,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {message}
            </p>
          </>
        ) : null}

        <Divider />
        <p
          style={{
            fontSize: 12,
            color: INK_SOFT,
            margin: 0,
          }}
        >
          Submitted {timestamp}
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
