import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          DEFAULT: "#9CA98A",
          deep: "#3A4F33",
          soft: "#B8C4A6",
        },
        cream: {
          DEFAULT: "#EFE8D6",
          soft: "#F5F0E1",
        },
        bone: "#E8E1CC",
        ink: "#3A3F31",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Cormorant Garamond", "serif"],
        sans: ["var(--font-sans)", "Lora", "serif"],
      },
      letterSpacing: {
        eyebrow: "0.28em",
      },
    },
  },
  plugins: [],
};

export default config;
