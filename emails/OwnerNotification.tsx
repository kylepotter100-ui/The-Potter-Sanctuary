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
};

const SAGE = "#8A9E85";
const CREAM = "#F5F0E8";
const INK = "#1C1C1C";
const INK_SOFT = "#4A4A4A";
const LINE = "rgba(28,28,28,0.12)";

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Lora', Georgia, serif";

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
}: Props) {
  const rows: Array<[string, string]> = [
    ["Name", `${firstName} ${lastName}`],
    ["Phone", phone],
    ["Email", customerEmail],
    ["Treatment", treatmentName],
    ["Date", bookingDate],
    ["Time", bookingTime],
    ["Price", `£${treatmentPrice}`],
    ["Gender", gender || "—"],
    ["Message", message && message.trim() ? message : "None"],
    ["Submitted", timestamp],
  ];

  return (
    <Html lang="en">
      <Head />
      <Preview>
        New booking — {treatmentName} — {firstName} {lastName}
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
            padding: "24px 16px 32px",
          }}
        >
          <Section
            style={{
              background: "#ffffff",
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: "26px 26px 22px",
            }}
          >
            <Heading
              as="h1"
              style={{
                fontFamily: SERIF,
                fontWeight: 400,
                fontSize: 26,
                color: SAGE,
                margin: "0 0 4px",
                lineHeight: 1.2,
              }}
            >
              New Booking Request
            </Heading>
            <Text
              style={{
                fontSize: 12,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: INK_SOFT,
                margin: "0 0 18px",
              }}
            >
              The Potter Sanctuary
            </Text>

            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <tbody>
                {rows.map(([k, v], i) => (
                  <tr key={k}>
                    <td
                      style={{
                        fontFamily: SANS,
                        fontSize: 11,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: INK_SOFT,
                        padding: "10px 14px 10px 0",
                        width: 120,
                        verticalAlign: "top",
                        borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
                      }}
                    >
                      {k}
                    </td>
                    <td
                      style={{
                        fontFamily: SANS,
                        fontSize: 14,
                        color: INK,
                        padding: "10px 0",
                        verticalAlign: "top",
                        borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
                        wordBreak: "break-word" as const,
                      }}
                    >
                      {v}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Hr style={{ borderColor: LINE, margin: "20px 0 14px" }} />

            <Text
              style={{
                fontSize: 13,
                color: INK_SOFT,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Log in to your admin panel to confirm or manage this booking.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
