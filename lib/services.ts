export type Service = {
  slug: string;
  number: string;
  category: string;
  name: string;
  nameEm: string;
  duration: string;
  durationMinutes: number;
  pressure: string;
  suitedTo: string;
  price: number;
  priceLabel: string;
  shortDesc: string;
  longDesc: string[];
  image: { src: string; width: number; height: number; alt: string };
  reverse: boolean;
  bookingId: string;
  seo: {
    title: string;
    description: string;
    h1: string;
    keywords: string[];
  };
};

export const services: Service[] = [
  {
    slug: "aromatherapy",
    number: "No. 01 — Signature",
    category: "Signature",
    name: "Full Body",
    nameEm: "Aromatherapy",
    duration: "60 min",
    durationMinutes: 60,
    pressure: "Light · Medium",
    suitedTo: "All skin",
    price: 50,
    priceLabel: "£50",
    shortDesc:
      "A full-body session blending bespoke essential-oil blends — selected on the day for your nervous system. Long, flowing strokes warm the muscles while the oils settle into the skin, leaving you softened and quietly elsewhere.",
    longDesc: [
      "A full-body aromatherapy massage in Suffolk delivered the way it's meant to be — slow, hand-led, and tailored to your nervous system on the day. Each session begins with a quiet consultation and a bespoke blend of essential oils chosen from PrecyseByNature's plant-based range.",
      "Long, flowing strokes warm the muscles from the soles of the feet to the crown of the head. The whipped, plant-based oils settle into the skin without leaving a film, so you go home softened, scented gently, and quietly elsewhere.",
      "Best for first-time visitors, anyone who works at a screen, and anyone craving a pure relaxing aromatherapy treatment near Mildenhall delivered by a fully trained Clarins therapist.",
    ],
    image: {
      src: "/aromatherapy.jpg",
      width: 1024,
      height: 1024,
      alt: "Full body aromatherapy massage in progress at The Potter Sanctuary, with plant-based essential oils on linen drapes.",
    },
    reverse: false,
    bookingId: "full-body-aromatherapy",
    seo: {
      title:
        "Full Body Aromatherapy Massage Suffolk | The Potter Sanctuary, Beck Row",
      description:
        "A 60-minute full body aromatherapy massage in Suffolk, with bespoke plant-based essential oil blends. Led personally by a fully trained Clarins therapist in our private Beck Row studio.",
      h1: "Full Body Aromatherapy Massage in Suffolk",
      keywords: [
        "full body aromatherapy massage Suffolk",
        "aromatherapy massage Beck Row",
        "essential oil massage therapy Suffolk",
        "relaxing aromatherapy treatment near Mildenhall",
        "plant-based massage Suffolk",
      ],
    },
  },
  {
    slug: "back-neck-scalp",
    number: "No. 02 — Restorative",
    category: "Restorative",
    name: "Back, Neck",
    nameEm: "& Scalp",
    duration: "30 min",
    durationMinutes: 30,
    pressure: "Medium · Firm",
    suitedTo: "Tension",
    price: 25,
    priceLabel: "£25",
    shortDesc:
      "A focused 30-minute reset for screen-tightened shoulders, the bridge of the neck, and a slow scalp release. Ideal at the end of a long week, or as a regular monthly maintenance ritual.",
    longDesc: [
      "A targeted back, neck and scalp massage in Suffolk for the parts of the body that take the most strain — the shoulders, the cervical spine, and the scalp. Thirty minutes is enough time to unwind a week's worth of desk hours without losing an entire afternoon.",
      "We work medium-to-firm pressure through the upper back and shoulders, ease the bridge of the neck, and finish with a slow scalp release that lingers long after you leave the studio.",
      "Recommended as a regular monthly tension relief massage in Beck Row — a quiet hour for anyone searching for a reliable back massage near Mildenhall, or a restorative scalp massage treatment in Suffolk.",
    ],
    image: {
      src: "/back-neck-scalp.jpg",
      width: 2500,
      height: 1533,
      alt: "Back, neck and scalp massage being delivered at The Potter Sanctuary in Beck Row, Suffolk.",
    },
    reverse: true,
    bookingId: "back-neck-scalp",
    seo: {
      title:
        "Back, Neck & Scalp Massage Suffolk | Tension Relief in Beck Row",
      description:
        "A 30-minute back, neck and scalp massage in Suffolk — focused tension relief delivered by a fully trained Clarins therapist in a private Beck Row studio.",
      h1: "Back, Neck & Scalp Massage in Suffolk",
      keywords: [
        "back neck and scalp massage Suffolk",
        "tension relief massage Beck Row",
        "back massage near Mildenhall",
        "scalp massage treatment Suffolk",
      ],
    },
  },
  {
    slug: "hot-stones-full-body",
    number: "No. 03 — Deep Heat",
    category: "Deep Heat",
    name: "Hot Stones",
    nameEm: "Full Body",
    duration: "75 min",
    durationMinutes: 75,
    pressure: "Medium",
    suitedTo: "Deep release",
    price: 60,
    priceLabel: "£60",
    shortDesc:
      "Heated basalt stones placed along the body's energy lines and worked through the muscles in long, weighted strokes. The depth of release is unlike a standard massage — heat travels where pressure alone cannot reach.",
    longDesc: [
      "A 75-minute hot stone massage in Suffolk that carries heat into places pressure alone can't reach. Smooth basalt stones are warmed and placed along the body's energy lines, then worked through the muscles in long, weighted strokes.",
      "The combination of heat and weight gives a depth of release unlike a standard massage — particularly recommended for stubborn lower back tension, tired legs, and anyone in need of deep relaxation hot stone therapy in Suffolk after a stretched week.",
      "All oils used are plant-based and made in small batches by PrecyseByNature. The studio takes one guest at a time, so the pace is genuinely unhurried from arrival to herbal tea.",
    ],
    image: {
      src: "/hot-stone-full-body.webp",
      width: 1024,
      height: 585,
      alt: "Heated basalt stones laid along the body for the hot stones full body treatment in Suffolk.",
    },
    reverse: false,
    bookingId: "hot-stones-full",
    seo: {
      title:
        "Hot Stone Massage Suffolk | Full Body Hot Stones in Beck Row",
      description:
        "A 75-minute hot stones full body treatment in Beck Row, Suffolk. Heated basalt stones, plant-based oils, delivered by a fully trained Clarins therapist.",
      h1: "Hot Stones Full Body Massage in Suffolk",
      keywords: [
        "hot stone massage Suffolk",
        "hot stones full body treatment Beck Row",
        "deep relaxation hot stone therapy Suffolk",
      ],
    },
  },
  {
    slug: "hot-stones-back",
    number: "No. 04 — Targeted",
    category: "Targeted",
    name: "Hot Stones",
    nameEm: "Back",
    duration: "45 min",
    durationMinutes: 45,
    pressure: "Medium · Firm",
    suitedTo: "Back tension",
    price: 35,
    priceLabel: "£35",
    shortDesc:
      "A back-only edition of the hot-stone ritual — concentrated heat and pressure through the lower, mid and upper back. Recommended for stubborn knots and chronic stiffness between the shoulder blades.",
    longDesc: [
      "A targeted hot stone back massage in Suffolk — forty-five minutes of concentrated heat and pressure through the lower, mid and upper back. Ideal for stubborn knots, chronic stiffness between the shoulder blades, and anyone who carries their week in their back.",
      "Stones are layered along the spine and worked outward with medium-to-firm pressure. Heat softens the fascia so deeper strokes land without bracing, and the result is a noticeable release that holds for days.",
      "A focused alternative to the full body session for anyone short on time but still in need of a hot stone back massage in Suffolk delivered with care, by a fully trained Clarins therapist.",
    ],
    image: {
      src: "/hot-stone-back.jpg",
      width: 1280,
      height: 853,
      alt: "Hot stones layered along the back during a targeted hot stone back massage in Beck Row, Suffolk.",
    },
    reverse: true,
    bookingId: "hot-stones-back",
    seo: {
      title:
        "Hot Stone Back Massage Suffolk | The Potter Sanctuary, Beck Row",
      description:
        "A 45-minute hot stone back massage in Suffolk. Targeted heat and pressure through the lower, mid and upper back, in a private Beck Row studio.",
      h1: "Hot Stone Back Massage in Suffolk",
      keywords: [
        "hot stone back massage Suffolk",
        "hot stones back treatment Beck Row",
        "back tension hot stone therapy Suffolk",
      ],
    },
  },
];

export function getService(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}

export function serviceSlugs(): string[] {
  return services.map((s) => s.slug);
}
