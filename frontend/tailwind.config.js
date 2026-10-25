/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Airtable Typography Stack: Haas / Inter Display fallback
        sans: [
          '"Haas Groot Disp"',
          'Haas',
          '"Inter Display"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'sans-serif',
        ],
        body: [
          'Haas',
          '"Inter Display"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        title: [
          '"Haas Groot Disp"',
          'Haas',
          '"Inter Display"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        display: [
          '"Haas Groot Disp"',
          'Haas',
          '"Inter Display"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        pricing: [
          '"Inter Display"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Airtable Core Tokens from DESIGN.md
        airtable: {
          primary: '#181d26',
          'primary-active': '#0d1218',
          ink: '#181d26',
          body: '#333840',
          muted: '#41454d',
          hairline: '#dddddd',
          'border-strong': '#9297a0',
          canvas: '#ffffff',
          'surface-soft': '#f8fafc',
          'surface-strong': '#e0e2e6',
          'surface-dark': '#181d26',
          'surface-dark-elevated': '#1d1f25',

          // Signature Card Palette & Aliases
          coral: '#aa2d00',
          'signature-coral': '#aa2d00',
          forest: '#0a2e0e',
          'signature-forest': '#0a2e0e',
          cream: '#f5e9d4',
          'signature-cream': '#f5e9d4',
          peach: '#fcab79',
          'signature-peach': '#fcab79',
          mint: '#a8d8c4',
          'signature-mint': '#a8d8c4',
          yellow: '#f4d35e',
          'signature-yellow': '#f4d35e',
          mustard: '#d9a441',
          'signature-mustard': '#d9a441',

          // Text on Dark Surfaces
          'on-primary': '#ffffff',
          'on-dark': '#ffffff',

          // Semantic
          link: '#1b61c9',
          'link-active': '#1a3866',
          info: '#254fad',
          'info-border': '#458fff',
          success: '#006400',
          'success-border': '#39bf45',
          'pricing-ink': '#1d1f25',
        },
      },
      borderRadius: {
        xs: '2px',      // Cookie consent & legal CTA buttons
        sm: '6px',      // Text inputs, small inline buttons
        md: '10px',     // Secondary content cards, article cards, cream callouts
        lg: '12px',     // Primary CTA buttons, signature cards, tabbed feature cards
        pill: '9999px', // Pricing CTA buttons
        full: '9999px', // Circular icon buttons, avatar surfaces
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '96px', // Universal Airtable vertical rhythm constant
      },
      fontSize: {
        // Airtable Typography Scale
        'display-xl': ['48px', { lineHeight: '1.1', letterSpacing: '0', fontWeight: '500' }],
        'display-lg': ['40px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '400' }],
        'display-md': ['32px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '400' }],
        'title-lg':   ['24px', { lineHeight: '1.35', letterSpacing: '0.12px', fontWeight: '400' }],
        'title-md':   ['20px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'title-sm':   ['18px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        'label-md':   ['16px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        'button':     ['16px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        'body-md':    ['14px', { lineHeight: '1.25', letterSpacing: '0', fontWeight: '400' }],
        'caption':    ['14px', { lineHeight: '1.35', letterSpacing: '0.16px', fontWeight: '500' }],
        'legal':      ['13.12px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '600' }],
        'pricing-display':    ['44.8px', { lineHeight: '1.1', letterSpacing: '0', fontWeight: '475' }],
        'pricing-section':    ['28px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '475' }],
        'pricing-card-title': ['20px', { lineHeight: '1.3', letterSpacing: '0', fontWeight: '475' }],
      },
      boxShadow: {
        'hairline': '0 0 0 1px #dddddd',
        '2xs': '0 1px 2px rgba(0, 0, 0, 0.03)',
        'xs': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'soft': '0 4px 14px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
