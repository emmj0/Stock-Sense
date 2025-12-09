import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        'primary': '#000000',
        'secondary': '#ffffff',
        'accent': '#2563eb',
        'accent-light': '#3b82f6',
        'text-primary': '#000000',
        'text-secondary': '#6b7280',
        'border': '#e5e7eb',
        'bg-light': '#f9fafb',
      },
    },
    animation: {
      'fade-in': 'fadeIn 0.6s ease-out',
      'slide-in': 'slideIn 0.7s ease-out',
      'slide-up': 'slideUp 0.6s ease-out',
    },
    keyframes: {
      fadeIn: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      slideIn: {
        '0%': { transform: 'translateX(-20px)', opacity: '0' },
        '100%': { transform: 'translateX(0)', opacity: '1' },
      },
      slideUp: {
        '0%': { transform: 'translateY(20px)', opacity: '0' },
        '100%': { transform: 'translateY(0)', opacity: '1' },
      },
    },
  },
  plugins: [],
};

export default config;
