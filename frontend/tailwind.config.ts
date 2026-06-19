import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1320px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-outfit)", "sans-serif"],
      },
      colors: {
        // Brand palette — refined azure + luxury accents
        ink: { 950: "#070b16", 900: "#0a0f1e", 800: "#0e1424", 700: "#141b2e", 600: "#1b2236" },
        brand: {
          DEFAULT: "#2dd4ff",
          400: "#38bdf8",
          500: "#1ba9e8",
          600: "#0a84d8",
          gold: "#e3b341",
          emerald: "#34d399",
        },
        // shadcn semantic tokens (CSS variables)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(45,212,255,0.10), 0 8px 30px -12px rgba(45,212,255,0.35)",
        "glow-lg": "0 0 0 1px rgba(45,212,255,0.14), 0 18px 50px -16px rgba(45,212,255,0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 16px 40px -24px rgba(0,0,0,0.8)",
        lift: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -28px rgba(0,0,0,0.85)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        float: "float 5s ease-in-out infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
