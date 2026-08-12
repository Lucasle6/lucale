/**
 * Tailwind v4 se integra como plugin de PostCSS y ya no necesita un
 * tailwind.config.js: la configuración vive en CSS, con la directiva @theme
 * (ver src/app/globals.css).
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
