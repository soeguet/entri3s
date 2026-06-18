/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./*.{js,ts,jsx,tsx}", "./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        success: {
          surface: "var(--success-surface)",
          border: "var(--success-border)",
          accent: "var(--success-accent)",
          solid: "var(--success-solid)",
          "solid-foreground": "var(--success-solid-foreground)",
        },
        warning: {
          surface: "var(--warning-surface)",
          border: "var(--warning-border)",
          accent: "var(--warning-accent)",
          solid: "var(--warning-solid)",
          "solid-foreground": "var(--warning-solid-foreground)",
        },
        danger: {
          surface: "var(--danger-surface)",
          border: "var(--danger-border)",
          accent: "var(--danger-accent)",
          solid: "var(--danger-solid)",
          "solid-foreground": "var(--danger-solid-foreground)",
        },
        info: {
          surface: "var(--info-surface)",
          border: "var(--info-border)",
          accent: "var(--info-accent)",
        },
      },
    },
  },
  plugins: [],
};
