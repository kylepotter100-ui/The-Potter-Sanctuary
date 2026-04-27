type Props = {
  className?: string;
  decorative?: boolean;
  segmented?: boolean;
};

const PETALS = [
  "M152 380 C 130 360, 100 350, 70 360 C 56 365, 60 380, 78 380 C 110 382, 134 384, 152 384 Z",
  "M152 380 C 174 360, 206 348, 234 358 C 248 363, 244 380, 226 380 C 196 384, 172 384, 152 384 Z",
  "M152 384 C 144 360, 142 336, 148 312 C 150 320, 154 348, 156 384 Z",
  "M152 384 C 152 340, 152 280, 156 220",
  "M150 222 C 156 212, 168 212, 172 220 C 168 228, 156 230, 150 224 Z",
  "M156 150 C 144 110, 144 80, 156 56 C 168 80, 168 110, 156 150 Z",
  "M156 150 C 124 130, 102 102, 96 76 C 110 78, 138 102, 156 150 Z",
  "M156 150 C 188 130, 210 102, 216 76 C 202 78, 174 102, 156 150 Z",
  "M156 150 C 122 158, 92 156, 70 142 C 88 130, 122 134, 156 150 Z",
  "M156 150 C 190 158, 220 156, 242 142 C 224 130, 190 134, 156 150 Z",
  "M156 150 C 138 188, 138 214, 150 222 C 162 214, 174 188, 156 150 Z",
  "M138 138 C 138 118, 178 116, 182 134 C 184 156, 178 174, 158 176 C 140 176, 134 158, 138 138 Z",
  "M140 130 C 148 122, 158 120, 168 124 C 175 127, 182 130, 184 134",
  "M142 134 C 150 132, 162 130, 174 132",
  "M152 142 C 152 152, 152 160, 154 168",
  "M158 140 C 160 152, 160 160, 160 168",
  "M164 144 C 166 154, 166 160, 166 168",
  "M154 168 L 154 169",
  "M160 168 L 160 169",
  "M166 168 L 166 169",
];

export default function BrandMark({
  className,
  decorative = true,
  segmented = false,
}: Props) {
  return (
    <svg
      viewBox="0 0 300 420"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
    >
      <g
        fill="none"
        stroke="#EFE8D6"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PETALS.map((d, i) => (
          <path key={i} d={d} className={segmented ? "draw seg" : undefined} />
        ))}
      </g>
    </svg>
  );
}
