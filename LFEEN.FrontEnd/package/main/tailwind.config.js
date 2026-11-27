/**
 * Tailwind for the LFEEN admin — added for the executive dashboard (/d3/ceo) and new work.
 *
 * Safe next to the existing Angular Material + SCSS pages:
 *  - prefix `tw-`: no utility can collide with an existing class (flex, grid, rounded…).
 *  - preflight off: Tailwind's base reset is NOT applied, so no current page changes.
 *
 * The theme carries the LFEEN host-dashboard design values (colours, radii, shadows,
 * motion), so `tw-shadow-card`, `tw-ease-soft`, `tw-duration-hover`… mean the same thing
 * in both products.
 *
 * Metric colour: put `tw-tone-{navy|green|blue|red|amber|violet}` on an element, then use
 * `tw-text-tone`, `tw-bg-tone-soft`, `tw-shadow-icon` inside it.
 *
 * @type {import('tailwindcss').Config}
 */
const plugin = require('tailwindcss/plugin');

const TONES = {
  navy: ['#111827', '#F1F5F9', 'rgba(17, 24, 39, 0.28)'],
  green: ['#059669', '#ECFDF5', 'rgba(5, 150, 105, 0.3)'],
  blue: ['#2563EB', '#EFF6FF', 'rgba(37, 99, 235, 0.28)'],
  red: ['#DC2626', '#FEF2F2', 'rgba(220, 38, 38, 0.28)'],
  amber: ['#D97706', '#FFFBEB', 'rgba(217, 119, 6, 0.28)'],
  violet: ['#7C3AED', '#F5F3FF', 'rgba(124, 58, 237, 0.28)'],
};

module.exports = {
  prefix: 'tw-',
  content: ['./src/**/*.{html,ts}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: { cairo: ['Cairo', 'sans-serif'] },
      colors: {
        ink: '#111827',
        body: '#475569',
        muted: '#64748B',
        faint: '#94A3B8',
        line: '#EEF2F7',
        'line-strong': '#E5E9F0',
        divider: '#F1F5F9',
        tile: '#F8FAFC',
        tone: { DEFAULT: 'var(--tone)', soft: 'var(--tone-soft)' },
      },
      borderRadius: { card: '18px', tile: '14px', icon: '14px', 'icon-sm': '11px' },
      boxShadow: {
        card: '0 14px 40px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 18px 44px rgba(15, 23, 42, 0.08)',
        'tile-hover': '0 10px 24px rgba(15, 23, 42, 0.06)',
        icon: 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 14px -10px var(--tone-shadow)',
        'icon-hover': 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 10px 18px -10px var(--tone-shadow)',
      },
      backgroundImage: {
        'icon-light': 'linear-gradient(150deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 60%)',
      },
      // Host dashboard motion (shared/styles/_motion.scss there).
      transitionTimingFunction: { soft: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      transitionDuration: { hover: '260ms', icon: '420ms', enter: '600ms' },
      keyframes: {
        enter: { from: { opacity: '0', transform: 'translateY(10px)' } },
      },
      animation: {
        enter: 'enter 600ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities, addVariant }) => {
      addUtilities(
        Object.fromEntries(
          Object.entries(TONES).map(([name, [tone, soft, shadow]]) => [
            `.tone-${name}`,
            { '--tone': tone, '--tone-soft': soft, '--tone-shadow': shadow },
          ]),
        ),
      );
      // Hover effects only with a real pointer — on touch screens :hover sticks after a tap.
      addVariant('can-hover', '@media (hover: hover) and (pointer: fine)');
    }),
  ],
};
