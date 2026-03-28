/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}",
    "../../examples/*/src/**/*.{ts,tsx}",
    "../../packages/jiki-ui/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        display: ["var(--font-instrument-serif)", "Georgia", "serif"],
      },
      colors: {
        accent: {
          DEFAULT: "#10b981",
          light: "#34d399",
          dark: "#059669",
        },
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "#d4d4d8",
            "--tw-prose-headings": "#fafafa",
            "--tw-prose-links": "#34d399",
            "--tw-prose-code": "#e4e4e7",
            "--tw-prose-bold": "#fafafa",
            "--tw-prose-counters": "#a1a1aa",
            "--tw-prose-bullets": "#a1a1aa",
            "--tw-prose-hr": "#3f3f46",
            "--tw-prose-quotes": "#d4d4d8",
            "--tw-prose-quote-borders": "#3f3f46",
            "--tw-prose-captions": "#a1a1aa",
            "--tw-prose-th-borders": "#3f3f46",
            "--tw-prose-td-borders": "#27272a",
            "code::before": { content: '""' },
            "code::after": { content: '""' },
            /* Instrument Serif on all prose headings */
            "h1, h2, h3, h4": {
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontStyle: "italic",
              letterSpacing: "-0.01em",
            },
            h1: { fontSize: "2.25rem", lineHeight: "1.2" },
            h2: {
              fontSize: "1.75rem",
              lineHeight: "1.25",
              marginTop: "2.5rem",
            },
            h3: { fontSize: "1.375rem", lineHeight: "1.3", marginTop: "2rem" },
            h4: {
              fontSize: "1.125rem",
              lineHeight: "1.4",
              marginTop: "1.75rem",
            },
            /* Tighten paragraph spacing for better rhythm */
            p: {
              marginTop: "1.25rem",
              marginBottom: "1.25rem",
              lineHeight: "1.75",
            },
            li: { marginTop: "0.375rem", marginBottom: "0.375rem" },
            /* Refined blockquotes */
            blockquote: {
              fontStyle: "normal",
              borderLeftWidth: "2px",
            },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
