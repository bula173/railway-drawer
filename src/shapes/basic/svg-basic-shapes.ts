/**
 * SVG-based basic shapes definitions
 */

export const svgBasicShapes = {
  rectangle: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="28" height="22" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  circle: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="15" r="13" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  diamond: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 16 2 L 28 15 L 16 28 L 4 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  triangle: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 16 2 L 28 26 L 4 26 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  ellipse: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="15" rx="13" ry="11" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  roundedRectangle: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="28" height="22" rx="4" ry="4" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  hexagon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 16 2 L 26 7.5 L 26 22.5 L 16 28 L 6 22.5 L 6 7.5 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  pentagon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 16 2 L 27 11 L 23 27 L 9 27 L 5 11 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  star: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 16 2 L 20 12 L 30 12 L 22 18 L 26 28 L 16 22 L 6 28 L 10 18 L 2 12 L 12 12 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  trapezoid: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 8 4 L 24 4 L 28 26 L 4 26 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  cross: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="4" width="8" height="22" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
    <rect x="4" y="12" width="24" height="6" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  cylinder: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="6" rx="10" ry="4" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
    <rect x="6" y="6" width="20" height="16" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
    <ellipse cx="16" cy="22" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  oval: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="15" rx="12" ry="9" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  doubleRectangle: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="28" height="22" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
    <line x1="16" y1="4" x2="16" y2="26" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  lozenge: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 16 2 L 28 15 L 16 28 L 4 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  chevron: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 6 4 L 24 15 L 6 26" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  rightAngle: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 24 4 L 24 24 L 4 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  line: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <line x1="2" y1="15" x2="30" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
};
