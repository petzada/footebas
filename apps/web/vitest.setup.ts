import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine; navigation scrolls are no-ops in tests.
if (typeof window !== 'undefined') window.scrollTo = () => undefined;

// jsdom has no canvas: report it as unsupported quietly so stages fall back.
if (typeof HTMLCanvasElement !== 'undefined')
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
