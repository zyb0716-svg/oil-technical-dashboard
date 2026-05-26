/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      colors: {
        ink: '#172026',
        steel: '#52616b',
        panel: '#f7f8f6',
        line: '#d9ded7',
        bull: '#127c59',
        bear: '#b9383f',
        amber: '#b36b00'
      }
    },
  },
  plugins: [],
};
