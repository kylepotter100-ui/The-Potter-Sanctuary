// MOCKUP ONLY — presentational e-card template for the gift-voucher prototype.
// ONE parameterised template (treatment + price + code + validity), styled to
// echo public/og-image.png (sage field, cream ink, Cormorant serif, the real
// sanctuary-logo daffodil). No data, no logic — purely visual.

type Props = {
  treatmentName: string;
  price: string; // e.g. "£50"
  code: string; // e.g. "PS-7F2A-9K3D"
  validity?: string;
};

export default function VoucherCard({
  treatmentName,
  price,
  code,
  validity = "Valid for 12 months from purchase",
}: Props) {
  return (
    <div className="voucher-ecard" role="img" aria-label={`Gift voucher e-card for ${treatmentName}, ${price}, code ${code}`}>
      <div className="voucher-ecard-art">
        {/* The real brand mark (also used site-wide in Nav/Footer/Intro). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="voucher-flower" src="/sanctuary-logo.png" alt="" />
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
