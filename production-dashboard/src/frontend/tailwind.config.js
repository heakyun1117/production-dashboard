/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#171C8F',
        secondary: '#2D68C4',
        accent: '#88A7E1',
        bg: '#EDF1FE',
        ok: '#2D68C4',
        check: '#F59E0B',
        ng: '#EF4444',
      },
    },
  },
  plugins: [],
};
