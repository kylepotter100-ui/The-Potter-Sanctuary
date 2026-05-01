import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Props = {
  firstName: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  treatmentPrice: number;
};

const SAGE = "#8A9E85";
const SAGE_DEEP = "#6E8068";
const CREAM = "#F5F0E8";
const BONE = "#FBF7EC";
const INK = "#1C1C1C";
const INK_SOFT = "#4A4A4A";
const LINE = "rgba(28,28,28,0.12)";

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Lora', Georgia, serif";

export default function BookingConfirmed({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  treatmentPrice,
}: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your booking is confirmed — {bookingDate} at {bookingTime}
      </Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          background: CREAM,
          fontFamily: SANS,
          color: INK,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: "32px 16px",
          }}
        >
          <Section style={{ padding: "8px 8px 4px" }}>
            <Heading
              as="h1"
              style={{
                fontFamily: SERIF,
                fontWeight: 400,
                color: SAGE,
                fontSize: 30,
                lineHeight: 1.15,
                letterSpacing: "0.005em",
                margin: 0,
              }}
            >
              The Potter Sanctuary
            </Heading>
          </Section>

          <Section
            style={{
              background: "#ffffff",
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: "28px 28px 24px",
              marginTop: 18,
            }}
          >
            <Text
              style={{
                fontFamily: SERIF,
                fontSize: 22,
                lineHeight: 1.3,
                color: INK,
                margin: "0 0 14px",
              }}
            >
              Dear {firstName},
            </Text>

            <Text
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: INK_SOFT,
                margin: "0 0 14px",
              }}
            >
              Wonderful news — your session at The Potter Sanctuary is now
              confirmed. We've set this time aside for you and look forward to
              welcoming you in.
            </Text>

            <Section
              style={{
                background: BONE,
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: "18px 20px",
                margin: "22px 0",
              }}
            >
              <DetailRow label="Treatment" value={treatmentName} />
              <DetailRow label="Date" value={bookingDate} />
              <DetailRow label="Time" value={bookingTime} />
              <DetailRow label="Investment" value={`£${treatmentPrice}`} last />
            </Section>

            <Text
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: INK_SOFT,
                margin: "0 0 12px",
              }}
            >
              To get in touch, simply reply to this email or contact us at
              hello@thepottersanctuary.co.uk.
            </Text>

            <Hr
              style={{
                borderColor: LINE,
                margin: "22px 0 14px",
              }}
            />

            <Text
              style={{
                fontFamily: SERIF,
                fontSize: 16,
                fontStyle: "italic",
                color: SAGE_DEEP,
                margin: 0,
              }}
            >
              With warmth,
              <br />
              The Potter Sanctuary
            </Text>
          </Section>

          <Section
            style={{
              background: SAGE,
              borderRadius: 10,
              padding: "20px 24px",
              marginTop: 18,
              textAlign: "center" as const,
            }}
          >
            <Text
              style={{
                fontFamily: SERIF,
                fontSize: 16,
                color: "#ffffff",
                margin: 0,
                letterSpacing: "0.02em",
              }}
            >
              The Potter Sanctuary, Beck Row, Suffolk
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginBottom: last ? 0 : 8,
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: INK_SOFT,
              fontFamily: SANS,
              padding: "4px 12px 4px 0",
              width: 120,
              verticalAlign: "top",
            }}
          >
            {label}
          </td>
          <td
            style={{
              fontFamily: SERIF,
              fontSize: 17,
              color: INK,
              padding: "4px 0",
              verticalAlign: "top",
            }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
