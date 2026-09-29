/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#05070d",
          900: "#0a0e18",
          800: "#0f1524",
          700: "#161d30",
          600: "#1e2740",
        },
        accent: {
          indigo: "#6366f1",
          violet: "#8b5cf6",
          cyan: "#22d3ee",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 40px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};