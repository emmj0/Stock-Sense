import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0e27',
        'dark-card': '#161b2b',
        'dark-border': '#2a3142',
        'accent-green': '#10b981',
        'accent-red': '#ef4444',
        'accent-blue': '#3b82f6',
      },
    },
  },
  plugins: [],
};

export default config;
