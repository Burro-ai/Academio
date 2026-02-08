/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        surface: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
        // Liquid Glass color tokens
        glass: {
          white: {
            5: 'rgba(255, 255, 255, 0.05)',
            10: 'rgba(255, 255, 255, 0.10)',
            15: 'rgba(255, 255, 255, 0.15)',
            20: 'rgba(255, 255, 255, 0.20)',
            25: 'rgba(255, 255, 255, 0.25)',
            30: 'rgba(255, 255, 255, 0.30)',
            40: 'rgba(255, 255, 255, 0.40)',
            50: 'rgba(255, 255, 255, 0.50)',
            60: 'rgba(255, 255, 255, 0.60)',
            70: 'rgba(255, 255, 255, 0.70)',
          },
          dark: {
            5: 'rgba(0, 0, 0, 0.05)',
            10: 'rgba(0, 0, 0, 0.10)',
            15: 'rgba(0, 0, 0, 0.15)',
            20: 'rgba(0, 0, 0, 0.20)',
            25: 'rgba(0, 0, 0, 0.25)',
            30: 'rgba(0, 0, 0, 0.30)',
          },
          primary: {
            20: 'rgba(14, 165, 233, 0.20)',
            30: 'rgba(14, 165, 233, 0.30)',
            40: 'rgba(14, 165, 233, 0.40)',
          },
        },
      },
      fontFamily: {
        // Use Inter Variable for glass typography
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        // Glass baseline weight
        glass: '500',
      },
      letterSpacing: {
        // Improved legibility for glass
        glass: '0.02em',
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },
      backdropSaturate: {
        // Lensing & refraction
        120: '1.2',
        150: '1.5',
        180: '1.8',
      },
      backdropContrast: {
        // Lensing & refraction
        105: '1.05',
        110: '1.1',
        115: '1.15',
      },
      backgroundImage: {
        'gradient-mesh': `
          radial-gradient(at 40% 20%, hsla(199, 100%, 74%, 0.3) 0px, transparent 50%),
          radial-gradient(at 80% 0%, hsla(189, 100%, 56%, 0.2) 0px, transparent 50%),
          radial-gradient(at 0% 50%, hsla(355, 100%, 93%, 0.2) 0px, transparent 50%),
          radial-gradient(at 80% 50%, hsla(340, 100%, 76%, 0.15) 0px, transparent 50%),
          radial-gradient(at 0% 100%, hsla(22, 100%, 77%, 0.2) 0px, transparent 50%),
          radial-gradient(at 80% 100%, hsla(242, 100%, 70%, 0.15) 0px, transparent 50%),
          radial-gradient(at 0% 0%, hsla(343, 100%, 76%, 0.1) 0px, transparent 50%)
        `,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'gradient-shift': 'gradient-shift 15s ease infinite',
        'liquid-wobble': 'liquid-wobble 3s ease-in-out infinite',
        'specular-glow': 'specular-glow 2s ease-in-out infinite',
        'glass-shimmer': 'glass-shimmer 3s ease-in-out infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': {
            backgroundPosition: '0% 50%',
          },
          '50%': {
            backgroundPosition: '100% 50%',
          },
        },
        'liquid-wobble': {
          '0%, 100%': {
            transform: 'scale(1) rotate(0deg)',
            borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
          },
          '50%': {
            transform: 'scale(1.02) rotate(2deg)',
            borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%',
          },
        },
        'specular-glow': {
          '0%, 100%': {
            opacity: '0.5',
          },
          '50%': {
            opacity: '0.8',
          },
        },
        'glass-shimmer': {
          '0%': {
            backgroundPosition: '-200% 0',
          },
          '100%': {
            backgroundPosition: '200% 0',
          },
        },
      },
      boxShadow: {
        // Glass shadows used in CSS components
        'glass': '0 8px 32px 0 rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'glass-lg': '0 25px 50px -12px rgba(139, 92, 246, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        // Colored glow shadows
        'glass-glow': '0 8px 32px 0 rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'glass-glow-lg': '0 25px 50px -12px rgba(139, 92, 246, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'glass-glow-primary': '0 8px 32px 0 rgba(14, 165, 233, 0.2)',
        'glass-glow-pink': '0 8px 32px 0 rgba(236, 72, 153, 0.15)',
        'glass-inset': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
        'specular': '0 0 40px rgba(255, 255, 255, 0.3)',
      },
      borderWidth: {
        '0.5': '0.5px',
      },
    },
  },
  plugins: [],
};
