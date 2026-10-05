import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const configPath = resolve(process.cwd(), 'vercel.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));

describe('cabeceras del frontend en Vercel', () => {
  test('la CSP es obligatoria y limita scripts y conexiones', () => {
    const policy = headers['Content-Security-Policy'];
    expect(headers).not.toHaveProperty('Content-Security-Policy-Report-Only');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("connect-src 'self' https://siga-lud0.onrender.com");
    expect(policy).toContain("style-src-attr 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline|fonts\.googleapis|fonts\.gstatic/);
  });

  test('protege tipos, referencias, capacidades y framing sin duplicar HSTS', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Frame-Options']).toBe('DENY');
    for (const capability of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(headers['Permissions-Policy']).toContain(`${capability}=()`);
    }
    expect(headers).not.toHaveProperty('Strict-Transport-Security');
  });
});
