import './style.css';
const library = new URL(location.href).searchParams.get('library') || 'bootstrap';
if (['bootstrap', 'coreui', 'uikit'].includes(library)) (await import('./vanilla.mjs')).mount(library);
else if (['vuetify', 'quasar', 'antvue'].includes(library)) (await import('./vue.mjs')).mount(library);
else if (library === 'react-modal') (await import('./react.jsx')).mount();
else if (library === 'melt') { const { mount } = await import('svelte'); const { default: Dialog } = await import('./Dialog.svelte'); mount(Dialog, { target: document.querySelector('#app') }); }
else if (library === 'ng-zorro') await import('./angular.mjs');
else throw new Error('Unknown dialog library');
