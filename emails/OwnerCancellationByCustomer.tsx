import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Props = {
  firstName: string;
  lastName: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  customerEmail: string;
  customerPhone: string;
  reason?: string | null;
};

const INK = "#1C1C1C";
const INK_SOFT = "#4A4A4A";
const LINE = "rgba(28,28,28,0.12)";

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Lora', Georgia, serif";

export default function OwnerCancellationByCustomer({
  firstName,
  lastName,
  treatmentName,
  bookingDate,
  bookingTime,
  customerEmail,
  customerPhone,
  reason,
}: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Booking cancelled by customer — {firstName} {lastName}, {bookingDate}
      </Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          background: "#ffffff",
          fontFamily: SANS,
          color: INK,
        }}
      >
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: 32 }}>
          <Heading
            as="h1"
            style={{
              fontFamily: SERIF,
              fontWeight: 400,
              fontSize: 24,
              margin: "0 0 16px",
            }}
          >
            Booking cancelled by customer
          </Heading>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: INK_SOFT,
              margin: "0 0 18px",
            }}
          >
            {firstName} {lastName} has cancelled their{" "}
            <strong>{treatmentName}</strong> booking on{" "}
            <strong>{bookingDate}</strong> at <strong>{bookingTime}</strong>.
          </Text>

          {reason && reason.trim().length > 0 ? (
            <Section
              style={{
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: "14px 16px",
                margin: "0 0 18px",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: INK_SOFT,
                  margin: "0 0 6px",
                }}
              >
                Reason
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: INK,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {reason}
              </Text>
            </Section>
          ) : null}

          <Section
            style={{
              border: `1px solid ${LINE}`,
              borderRadius: 8,
              padding: "14px 16px",
            }}
          >
            <Text style={{ fontSize: 13, color: INK_SOFT, margin: "0 0 4px" }}>
              <strong>Email:</strong> {customerEmail}
            </Text>
            <Text style={{ fontSize: 13, color: INK_SOFT, margin: 0 }}>
              <strong>Phone:</strong> {customerPhone}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
