import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#050507",
        night: "#0b0d10",
        panel: "#11141a",
        line: "rgba(255,255,255,0.1)",
        acid: "#c7ff4f",
        skyglass: "#8be9ff",
        coral: "#ff6b6b"
      },
      boxShadow: {
        glow: "0 0 55px rgba(199,255,79,0.18)",
        soft: "0 24px 70px rgba(0,0,0,0.38)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial"]
      }
    }
  },
  plugins: []
};

export default config;
