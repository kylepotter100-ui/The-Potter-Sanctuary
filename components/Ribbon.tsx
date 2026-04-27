const items = [
  "Whipped Body Butter",
  "Sugar Scrub",
  "Essential Oils",
  "Plant-Based",
  "Slow Beauty",
  "PrecyseByNature",
];

export default function Ribbon() {
  return (
    <div className="ribbon" aria-hidden="true">
      <div className="ribbon-track">
        {[...items, ...items].map((it, i) => (
          <span key={i}>{it}</span>
        ))}
      </div>
    </div>
  );
}
