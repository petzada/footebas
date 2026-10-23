import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine; navigation scrolls are no-ops in tests.
if (typeof window !== 'undefined') window.scrollTo = () => undefined;
