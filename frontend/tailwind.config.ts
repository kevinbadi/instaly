import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // New color palette
        neon: {
          DEFAULT: "hsl(142 100% 50%)",
          50: "hsl(142 100% 95%)",
          100: "hsl(142 100% 85%)",
          200: "hsl(142 100% 75%)",
          300: "hsl(142 100% 65%)",
          400: "hsl(142 100% 55%)",
          500: "hsl(142 100% 50%)",
          600: "hsl(142 100% 45%)",
          700: "hsl(142 100% 40%)",
          800: "hsl(142 100% 30%)",
          900: "hsl(142 100% 20%)",
        },
        silver: {
          DEFAULT: "hsl(0 0% 75%)",
          50: "hsl(0 0% 98%)",
          100: "hsl(0 0% 95%)",
          200: "hsl(0 0% 90%)",
          300: "hsl(0 0% 80%)",
          400: "hsl(0 0% 70%)",
          500: "hsl(0 0% 60%)",
          600: "hsl(0 0% 50%)",
          700: "hsl(0 0% 40%)",
          800: "hsl(0 0% 30%)",
          900: "hsl(0 0% 20%)",
        },
        dark: {
          DEFAULT: "hsl(0 0% 4%)",
          50: "hsl(0 0% 20%)",
          100: "hsl(0 0% 15%)",
          200: "hsl(0 0% 12%)",
          300: "hsl(0 0% 10%)",
          400: "hsl(0 0% 8%)",
          500: "hsl(0 0% 6%)",
          600: "hsl(0 0% 5%)",
          700: "hsl(0 0% 4%)",
          800: "hsl(0 0% 3%)",
          900: "hsl(0 0% 2%)",
          950: "hsl(0 0% 1%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        glow: {
          "0%, 100%": { 
            boxShadow: "0 0 10px hsl(142 100% 50% / 0.3), 0 0 20px hsl(142 100% 50% / 0.2)" 
          },
          "50%": { 
            boxShadow: "0 0 20px hsl(142 100% 50% / 0.5), 0 0 40px hsl(142 100% 50% / 0.3)" 
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        shimmer: "shimmer 2s infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      fontFamily: {
        sf: [
          "-apple-system",
          "BlinkMacSystemFont", 
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont", 
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      backgroundImage: {
        "neon-gradient": "linear-gradient(135deg, hsl(142 100% 50%) 0%, hsl(160 100% 50%) 100%)",
        "silver-gradient": "linear-gradient(180deg, hsl(0 0% 85%) 0%, hsl(0 0% 65%) 50%, hsl(0 0% 75%) 100%)",
        "dark-gradient": "linear-gradient(180deg, hsl(0 0% 6%) 0%, hsl(0 0% 2%) 100%)",
        "card-gradient": "linear-gradient(180deg, hsl(0 0% 6%) 0%, hsl(0 0% 4%) 100%)",
      },
      boxShadow: {
        "neon": "0 0 20px hsl(142 100% 50% / 0.3), 0 0 40px hsl(142 100% 50% / 0.2)",
        "neon-sm": "0 0 10px hsl(142 100% 50% / 0.3), 0 0 20px hsl(142 100% 50% / 0.15)",
        "neon-lg": "0 0 30px hsl(142 100% 50% / 0.4), 0 0 60px hsl(142 100% 50% / 0.3), 0 0 90px hsl(142 100% 50% / 0.2)",
        "silver": "0 0 20px hsl(0 0% 75% / 0.2), 0 0 40px hsl(0 0% 75% / 0.1)",
        "dark": "0 10px 40px hsl(0 0% 0% / 0.5)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
