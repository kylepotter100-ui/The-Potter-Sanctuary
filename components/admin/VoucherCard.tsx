// MOCKUP ONLY — presentational e-card template for the gift-voucher prototype.
// ONE parameterised template (treatment + price + code + validity), styled to
// echo public/og-image.png (sage field, cream ink, Cormorant serif, a cream
// line-art botanical). No data, no logic — purely visual.

type Props = {
  treatmentName: string;
  price: string; // e.g. "£50"
  code: string; // e.g. "PS-7F2A-9K3D"
  validity?: string;
};

// Cream line-art daffodil — evokes the og-image flower (the repo has no SVG
// asset, so it's drawn inline). Decorative only.
function Daffodil() {
  return (
    <svg
      className="voucher-flower"
      viewBox="0 0 160 200"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="#F5F0E8"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* stem + leaves */}
        <path d="M80 96 C 80 130, 79 158, 80 192" />
        <path d="M80 150 C 58 142, 48 120, 55 102" />
        <path d="M80 160 C 102 152, 112 132, 105 114" />
        {/* petals */}
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse
            key={a}
            cx={80}
            cy={44}
            rx={11}
            ry={27}
            transform={`rotate(${a} 80 70)`}
          />
        ))}
        {/* trumpet */}
        <circle cx={80} cy={70} r={13} />
        <circle cx={80} cy={70} r={6} />
      </g>
    </svg>
  );
}

export default function VoucherCard({
  treatmentName,
  price,
  code,
  validity = "Valid for 12 months from purchase",
}: Props) {
  return (
    <div className="voucher-ecard" role="img" aria-label={`Gift voucher e-card for ${treatmentName}, ${price}, code ${code}`}>
      <div className="voucher-ecard-art">
        <Daffodil />
      </div>
      <div className="voucher-ecard-body">
        <div className="voucher-ecard-brand">The Potter Sanctuary</div>
        <div className="voucher-ecard-eyebrow">Gift Voucher</div>
        <div className="voucher-ecard-treatment">{treatmentName}</div>
        <div className="voucher-ecard-price">{price}</div>
        <div className="voucher-ecard-code" aria-label={`Code ${code}`}>
          {code}
        </div>
        <div className="voucher-ecard-validity">{validity}</div>
      </div>
    </div>
  );
}
