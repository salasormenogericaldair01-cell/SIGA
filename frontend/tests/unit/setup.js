import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
