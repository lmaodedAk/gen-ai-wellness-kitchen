import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#2d6a4f', 600: '#1a4035', 700: '#143028', 800: '#0d1f1a', 900: '#071310' },
        gold:  { 400: '#f0c050', 500: '#e8a020', 600: '#c8860a' },
        cream: '#f7f6f2',
        sidebar: { DEFAULT: '#1a3328', active: '#2d5a47', hover: '#244a3b' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
