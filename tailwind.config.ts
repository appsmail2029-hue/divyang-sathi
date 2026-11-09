import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f1f5fb",
          100: "#e0e9f5",
          200: "#c2d3e9",
          300: "#94b2d7",
          400: "#5f8bc0",
          500: "#3c6ba6",
          600: "#2c538b",
          700: "#254471",
          800: "#1a3358",
          900: "#0f2444",
          950: "#0a1830",
        },
        metro: {
          navy: "#0b2447",
          navyLight: "#123566",
          yellow: "#ffc72c",
          yellowSoft: "#ffdd75",
          red: "#d92d20",
          green: "#0f9d58",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,36,71,.06), 0 8px 24px rgba(11,36,71,.08)",
        alarm: "0 0 0 4px rgba(217,45,32,.25), 0 24px 64px rgba(217,45,32,.45)",
      },
      keyframes: {
        flash: {
          "0%, 100%": { backgroundColor: "#7f1d1d", borderColor: "#fecaca" },
          "50%": { backgroundColor: "#d92d20", borderColor: "#7f1d1d" },
        },
        flashSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.95)", opacity: "0.8" },
          "70%": { transform: "scale(1.05)", opacity: "0" },
          "100%": { transform: "scale(1.05)", opacity: "0" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        flash: "flash 1s ease-in-out infinite",
        flashSoft: "flashSoft 1.2s ease-in-out infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        slideUp: "slideUp .25s ease-out",
        blink: "blink .9s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
