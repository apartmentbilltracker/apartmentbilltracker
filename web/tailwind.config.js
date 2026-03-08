/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Light mode
        accent: "#b38604",
        "accent-dark": "#d4a017",
        "accent-light": "rgba(179,134,4,0.08)",
        "accent-surface": "#fff8e1",
        // Dark background palette
        "dark-bg": "#0f0c29",
        "dark-card": "#1a1a2e",
        "dark-card-elevated": "#1e2742",
        "dark-card-alt": "#16213e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
