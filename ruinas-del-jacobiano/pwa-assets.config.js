import { minimalPreset } from '@vite-pwa/assets-generator/presets/minimal';

/**
 * Generación de los íconos de la PWA a partir de public/icon.svg.
 * Comando: npm run icons
 *
 * El preset "minimal" genera los PNG de Android (any y maskable) y el
 * apple-touch-icon de iOS. Los PNG quedan en public/ y se comitean,
 * para que el deploy no dependa de regenerarlos.
 */
export default {
  preset: {
    ...minimalPreset,
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
    },
    apple: {
      sizes: [180],
    },
  },
  images: ['public/icon.svg'],
};
