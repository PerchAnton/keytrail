import SwaggerUI from 'swagger-ui-dist/swagger-ui-es-bundle.js';
import 'swagger-ui-dist/swagger-ui.css';

// Application-owned adaptations for this example, not an upstream patch.
export function mountSwagger({ corrected, trapFocus = true }) {
  SwaggerUI({ dom_id: '#app', docExpansion: 'full', defaultModelsExpandDepth: -1,
    validatorUrl: null, supportedSubmitMethods: [],
    spec: { openapi: '3.0.3', info: { title: 'Keyboard fixture', version: '1' },
      components: { securitySchemes: { DemoKey: { type: 'apiKey', in: 'header', name: 'X-Demo-Key' } } },
      paths: { '/example': { post: { summary: 'Example', requestBody: { content: {
        'application/json': { schema: { type: 'object', properties: { title: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' } } } } } } });
  if (!corrected) return;
  let opener;
  document.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key) && document.activeElement?.matches('button.authorize')) opener = document.activeElement;
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button.authorize');
    if (button) opener = button;
  }, true);
  let modal;
  let cleanModal = () => {};
  const observer = new MutationObserver(() => {
    const next = document.querySelector('.modal-ux');
    if (next !== modal) {
      cleanModal();
      if (!next && modal && opener?.isConnected) opener.focus();
      modal = next;
      if (modal) {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Available authorizations');
        const topClose = modal.querySelector('button.close-modal');
        topClose.setAttribute('aria-label', 'Close authorization');
        const focusable = () => [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')]
          .filter(element => element.getClientRects().length);
        const trap = event => {
          if (event.key !== 'Tab') return;
          const stops = focusable();
          const index = stops.indexOf(document.activeElement);
          if (event.shiftKey && index <= 0) { event.preventDefault(); stops.at(-1)?.focus(); }
          else if (!event.shiftKey && (index < 0 || index === stops.length - 1)) {
            event.preventDefault(); stops[0]?.focus();
          }
        };
        if (trapFocus) document.addEventListener('keydown', trap, true);
        cleanModal = () => document.removeEventListener('keydown', trap, true);
        topClose.focus();
      }
    }
    for (const list of document.querySelectorAll('[role=tablist]')) {
      const tabs = [...list.querySelectorAll('[role=tab]')];
      tabs.forEach(tab => { tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1; });
      if (list.dataset.keyboardExample) continue;
      list.dataset.keyboardExample = 'true';
      list.addEventListener('keydown', event => {
        const index = tabs.indexOf(document.activeElement);
        if (index < 0) return;
        const nextIndex = { ArrowRight: (index + 1) % tabs.length,
          ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
        if (nextIndex === undefined) return;
        event.preventDefault(); tabs[nextIndex].focus(); tabs[nextIndex].click();
      });
    }
  });
  observer.observe(document.getElementById('app'), { childList: true, subtree: true,
    attributes: true, attributeFilter: ['aria-selected'] });
}
