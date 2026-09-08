import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          950: "#062a24",
          900: "#0a3a30",
          800: "#0f4d3f",
          600: "#16794f",
          500: "#1f9d5f",
          400: "#34c777",
          100: "#e3f6ec",
        },
        ink: "#0c1512",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
