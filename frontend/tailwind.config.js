/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void:    '#000000',
        bone:    '#ffffff',
        ash:     '#9a9a9a',
        silver:  '#bdbdbd',
        iris:    '#8052ff',
        saffron: '#ffb829',
        verdant: '#15846e',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'cap':    ['12px', { lineHeight: '1.5' }],
        'nav':    ['14px', { lineHeight: '1.2', letterSpacing: '0.025em' }],
        'body':   ['18px', { lineHeight: '1.5' }],
        'h2xs':   ['24px', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        'hxs':    ['27px', { lineHeight: '1' }],
        'sub':    ['36px', { lineHeight: '1.2' }],
        'hsm':    ['42px', { lineHeight: '1.2', letterSpacing: '-0.04em' }],
        'h':      ['48px', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
        'hlg':    ['clamp(48px,6vw,78px)', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
        'disp':   ['clamp(56px,8vw,113px)', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
      },
      spacing: {
        '1.5': '6px',
        '3':   '12px',
        '4.5': '18px',
        '6':   '24px',
        '7.5': '30px',
        '9':   '36px',
        '15':  '60px',
        '24':  '96px',
        '30':  '120px',
      },
      borderRadius: {
        'pill': '9999px',
        'card': '24px',
      },
      maxWidth: {
        'page': '1280px',
      },
    },
  },
  plugins: [],
}
