/**
 * @file app-dom.ts
 * @brief Loads the real index.html body (without its module script) into the jsdom document
 */
import indexHtml from '../../../index.html?raw';

export function loadAppDom(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(indexHtml)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, '');
}

export function clearAppDom(): void {
  document.body.innerHTML = '';
}
