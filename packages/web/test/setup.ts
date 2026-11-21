import '@testing-library/jest-dom/vitest';

// jsdom has no native dialog implementation; emulate opening/closing only.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
