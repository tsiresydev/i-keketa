import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// jsdom n'implémente pas scrollTo sur les éléments.
window.HTMLElement.prototype.scrollTo = vi.fn();
