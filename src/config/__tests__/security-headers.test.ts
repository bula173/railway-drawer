import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { htaccessFor, lanHeaders, parseCsp, siteHeaders } from '../security-headers';

const ROOT = resolve(__dirname, '../../..');
const headersText = readFileSync(resolve(ROOT, 'public/_headers'), 'utf8');
const headers = new Map(siteHeaders(headersText).map(([n, v]) => [n.toLowerCase(), v]));

describe('public/_headers', () => {
  it('sets the security headers on every path', () => {
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('permissions-policy')).toContain('camera=()');
    expect(headers.get('x-frame-options')).toBe('DENY');
  });

  it('has a strict CSP', () => {
    const csp = parseCsp(headers.get('content-security-policy') ?? '');
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'none'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    for (const values of csp.values()) {
      expect(values).not.toContain("'unsafe-eval'");
      expect(values).not.toContain('*');
    }
    // Anthropic API, GitLab (any https host), the local MCP bridge
    expect(csp.get('connect-src')).toEqual(expect.arrayContaining(["'self'", 'https:', 'ws://127.0.0.1:*']));
    expect(csp.get('connect-src')).not.toContain('http:');
  });

  it('index.html has no inline scripts or inline event handlers (script-src self)', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const script of Array.from(doc.querySelectorAll('script'))) {
      expect(script.getAttribute('src'), script.outerHTML).toBeTruthy();
      expect(script.textContent?.trim()).toBe('');
    }
    for (const el of Array.from(doc.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('on'), `${el.localName}@${attr.name}`).toBe(false);
    }
  });

  it('LAN Apache variant: same headers, http: allowed for LAN servers, valid .htaccess', () => {
    const lan = lanHeaders(siteHeaders(headersText));
    const csp = parseCsp(new Map(lan.map(([n, v]) => [n.toLowerCase(), v])).get('content-security-policy') ?? '');
    expect(csp.get('connect-src')).toContain('http:');
    expect(csp.get('img-src')).toContain('http:');
    expect(csp.get('script-src')).toEqual(["'self'"]);
    const htaccess = htaccessFor(lan);
    expect(htaccess).toContain('<IfModule mod_headers.c>');
    expect(htaccess).toMatch(/Header always set Content-Security-Policy "default-src 'self';/);
    expect(htaccess).toContain('Header always set X-Content-Type-Options "nosniff"');
  });
});
