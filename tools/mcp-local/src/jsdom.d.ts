/** Minimal typing of the part of jsdom (devDependency of the app, used at runtime) the headless mode uses. */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: Record<string, unknown>);
    readonly window: Window & typeof globalThis;
  }
}
