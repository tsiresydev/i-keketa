import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// jsdom n'implémente pas scrollTo sur les éléments.
window.HTMLElement.prototype.scrollTo = vi.fn();

// jsdom n'implémente pas la manipulation d'URL d'objets (aperçu de photo).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:apercu-photo');
}

if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}
