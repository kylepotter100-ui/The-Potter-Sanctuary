import { Section } from "@react-email/components";
import {
  BONE,
  ContentSection,
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
  lastName: string;
  treatmentName: string; // new
  treatmentPrice: number; // new
  durationMinutes: number; // new
  bookingDate: string; // long date (new)
  bookingTime: string; // 12h (new)
  previousTreatmentName: string;
  previousPrice: number;
  previousDate: string;
  previousTime: string;
  moved: boolean;
  customerEmail: string;
  customerPhone: string;
  siteUrl: string;
};

// Owner copy — deliberately denser and more factual than the client email: no
// greeting, no reassurance, just what changed and how to reach the client.
export default function OwnerTreatmentChangeNotice({
  firstName,
  lastName,
  treatmentName,
  treatmentPrice,
  durationMinutes,
  bookingDate,
  bookingTime,
  previousTreatmentName,
  previousPrice,
  previousDate,
  previousTime,
  moved,
  customerEmail,
  customerPhone,
  siteUrl,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Treatment changed — ${firstName} ${lastName}, ${bookingDate}`}
    >
      <ContentSection>
        <SectionHeading>Treatment changed</SectionHeading>
        <Paragraph>
          <strong>
            {firstName} {lastName}
          </strong>
          &apos;s booking has been amended.
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
          <DetailRow
            label="Was"
            value={`${previousTreatmentName} · £${previousPrice} — ${previousDate} at ${previousTime}`}
          />
          <DetailRow
            label="Now"
            value={`${treatmentName} · ${durationMinutes} min · £${treatmentPrice} — ${bookingDate} at ${bookingTime}`}
          />
          <DetailRow
            label="Change"
            value={moved ? "Treatment and time" : "Treatment only"}
            last
          />
        </Section>

        <Divider />
        <Section
          style={{
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <p style={{ fontSize: 14, color: INK_SOFT, margin: "0 0 6px" }}>
            <strong>Email:</strong> {customerEmail}
          </p>
          <p style={{ fontSize: 14, color: INK_SOFT, margin: 0 }}>
            <strong>Phone:</strong> {customerPhone}
          </p>
        </Section>
      </ContentSection>
    </EmailLayout>
  );
}
