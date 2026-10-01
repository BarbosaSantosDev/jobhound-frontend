// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

import { mockMatchMedia } from './test/mockMatchMedia';

// Padrão: sistema em tema escuro e storage limpo. Testes que precisam de outro
// cenário chamam mockMatchMedia(true) por conta própria.
beforeEach(() => {
  mockMatchMedia(false);
  window.localStorage.clear();
});
