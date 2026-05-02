import {
  ContentSection,
  EmailLayout,
  Paragraph,
  SectionHeading,
} from "./_shared";

type Props = {
  firstName: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  siteUrl: string;
};

export default function CustomerCancellationConfirmation({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  siteUrl,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview="Your booking at The Potter Sanctuary has been cancelled."
    >
      <ContentSection>
        <SectionHeading>Your booking has been cancelled</SectionHeading>
        <Paragraph>
          Dear {firstName}, your booking for <strong>{treatmentName}</strong>{" "}
          on <strong>{bookingDate}</strong> at <strong>{bookingTime}</strong>{" "}
          has been cancelled.
        </Paragraph>
        <Paragraph>We hope to see you again soon.</Paragraph>
      </ContentSection>
    </EmailLayout>
  );
}
