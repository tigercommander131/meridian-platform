/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        line: "var(--line)",
        accent: { DEFAULT: "var(--accent)", hover: "var(--accent-hover)", soft: "var(--accent-soft)", ink: "var(--accent-ink)" },
        board: { DEFAULT: "var(--board)", 2: "var(--board-2)", line: "var(--board-line)", ink: "var(--board-ink)" },
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06)",
        soft: "0 6px 16px -4px rgba(16,24,40,.10), 0 2px 6px -2px rgba(16,24,40,.06)",
        pop: "0 24px 50px -12px rgba(16,24,40,.22)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0, transform: "translateY(5px)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: { "fade-in": "fade-in .28s ease both" },
    },
  },
  plugins: [],
};
