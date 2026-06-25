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
  treatmentName: string;
  visitDate: string;
  rating: number;
  comment: string | null;
  siteUrl: string;
};

export default function OwnerReviewNotification({
  firstName,
  lastName,
  treatmentName,
  visitDate,
  rating,
  comment,
  siteUrl,
}: Props) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  const stars = "★".repeat(clamped) + "☆".repeat(5 - clamped);
  const hasComment = !!comment && comment.trim().length > 0;

  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`New review — ${stars} — ${firstName} ${lastName}`}
    >
      <ContentSection>
        <SectionHeading>New review received</SectionHeading>
        <Paragraph>
          {firstName} {lastName} has left a review.
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
          <DetailRow label="Treatment" value={treatmentName} />
          <DetailRow label="Visit" value={visitDate} />
          <DetailRow label="Rating" value={`${stars}  (${clamped}/5)`} last />
        </Section>

        <Divider />
        <SectionHeading>Their comment</SectionHeading>
        {hasComment ? (
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: INK,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {comment}
          </p>
        ) : (
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: INK_SOFT,
              margin: 0,
              fontStyle: "italic",
            }}
          >
            No written comment.
          </p>
        )}
      </ContentSection>
    </EmailLayout>
  );
}
