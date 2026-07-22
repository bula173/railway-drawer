/**
 * SVG Arrow definitions - Arrow shapes using native SVG rendering
 */

export const svgArrows = {
  // Wide block arrow
  wideArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 1.5 6.3 L 21.8 6.3 L 21.8 6.3 L 30.5 15 L 21.8 23.7 L 21.8 23.7 L 1.5 23.7 L 10.2 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  thinArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 1.5 12.13 L 24.7 12.13 L 24.7 6.3 L 30.5 15 L 24.7 23.7 L 24.7 17.87 L 1.5 17.87 L 1.5 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  doubleArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 1.5 6.3 L 18.9 6.3 L 18.9 12.1 L 24.7 12.1 L 24.7 9.2 L 30.5 15 L 24.7 20.8 L 24.7 17.9 L 18.9 17.9 L 18.9 23.7 L 1.5 23.7 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  notchedArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 1.5 12.13 L 25.28 12.13 L 21.78 6.3 L 25.28 6.3 L 30.5 15 L 25.28 23.7 L 21.78 23.7 L 25.28 17.87 L 1.5 17.87 L 1.5 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  splitArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 9.04 7.75 L 22.96 7.75 L 22.96 12.1 L 24.7 12.1 L 24.7 9.2 L 30.5 15 L 24.7 20.8 L 24.7 17.9 L 22.96 17.9 L 22.96 22.25 L 9.04 22.25 L 9.04 17.9 L 7.3 17.9 L 7.3 20.8 L 1.5 15 L 7.3 9.2 L 7.3 12.1 L 9.04 12.1 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  curvedArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 19.24 1.5 L 29.5 8.92 L 19.24 16.35 L 19.24 12.97 L 10.6 12.97 L 10.6 28.5 L 6.55 28.5 L 2.5 28.5 L 2.5 4.87 L 19.24 4.87 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  loopArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 19.24 1.5 L 29.5 8.92 L 19.24 16.35 L 19.24 12.97 C 9.99 12.98 2.5 19.93 2.5 28.5 C 2.5 15.45 9.99 4.88 19.24 4.87 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  roundedLoopArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 14.58 1.5 L 21.33 7.3 L 14.58 13.11 L 14.58 10.27 C 11.19 10.27 8.44 13.03 8.44 16.42 C 8.44 19.81 11.19 22.56 14.58 22.56 L 29.5 22.56 L 29.5 28.5 L 14.58 28.5 C 7.91 28.5 2.5 23.09 2.5 16.42 C 2.5 9.74 7.91 4.33 14.58 4.33 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  chevronArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 18.7 8.52 L 22.48 8.52 L 22.48 12.3 L 24.1 12.3 L 24.1 9.6 L 29.5 15 L 24.1 20.4 L 24.1 17.7 L 22.48 17.7 L 22.48 21.48 L 18.7 21.48 L 18.7 23.1 L 21.4 23.1 L 16 28.5 L 10.6 23.1 L 13.3 23.1 L 13.3 21.48 L 9.52 21.48 L 9.52 17.7 L 7.9 17.7 L 7.9 20.4 L 2.5 15 L 7.9 9.6 L 7.9 12.3 L 9.52 12.3 L 9.52 8.52 L 13.3 8.52 L 13.3 6.9 L 10.6 6.9 L 16 1.5 L 21.4 6.9 L 18.7 6.9 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  zigzagArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 18.9 16.45 L 24.7 16.45 L 24.7 13.55 L 30.5 19.35 L 24.7 25.15 L 24.7 22.25 L 7.3 22.25 L 7.3 25.15 L 1.5 19.35 L 7.3 13.55 L 7.3 16.45 L 13.1 16.45 L 13.1 10.65 L 10.2 10.65 L 16 4.85 L 21.8 10.65 L 18.9 10.65 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  hollowArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 1.5 10.94 L 18.9 10.94 L 18.9 4.85 L 30.5 15 L 18.9 25.15 L 18.9 19.06 L 1.5 19.06 L 1.5 15 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  triangleArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 2.46 14.39 L 16.61 28.54 L 29.54 1.46 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,

  leftArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 1.5 10.94 L 18.9 10.94 L 18.9 4.85 L 30.5 15 L 18.9 25.15 L 18.9 19.06 L 1.5 19.06 L 1.5 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10" transform="translate(16,0)scale(-1,1)translate(-16,0)"/>
  </svg>`,

  upArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 2.5 11.22 L 18.7 11.22 L 18.7 5.55 L 29.5 15 L 18.7 24.45 L 18.7 18.78 L 2.5 18.78 L 2.5 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10" transform="rotate(270,16,15)"/>
  </svg>`,

  downArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 2.5 11.22 L 18.7 11.22 L 18.7 5.55 L 29.5 15 L 18.7 24.45 L 18.7 18.78 L 2.5 18.78 L 2.5 15 Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10" transform="rotate(90,16,15)"/>
  </svg>`,
};
