import { createApp, h, ref, onMounted, onUnmounted } from 'vue';
import { DialogRoot, DialogTrigger, DialogPortal, DialogOverlay, DialogContent,
  DialogTitle, DialogDescription, DialogClose } from 'reka-ui';

export function mountReka({ returnElsewhere = false, nativeReturn = false }) {
  createApp({ setup() {
    const open = ref(false);
    const shortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); open.value = true;
      }
    };
    onMounted(() => document.addEventListener('keydown', shortcut));
    onUnmounted(() => document.removeEventListener('keydown', shortcut));
    return () => h('section', [h('h1', 'Vue dialog contract'),
      h('label', { for: 'other-field' }, 'Other field'), h('input', { id: 'other-field' }),
      h(DialogRoot, { open: open.value, 'onUpdate:open': value => { open.value = value; } }, () => [
        h(DialogTrigger, { asChild: true }, () => h('button', { id: 'reka-open' }, 'Edit profile')),
        h(DialogPortal, {}, () => [h(DialogOverlay, { class: 'demo-overlay' }),
          h(DialogContent, { class: 'demo-dialog', 'aria-modal': 'true', onOpenAutoFocus: event => {
            event.preventDefault(); document.getElementById('profile-name')?.focus();
          }, onCloseAutoFocus: event => {
            if (!nativeReturn) {
              event.preventDefault(); document.getElementById(returnElsewhere ? 'other-field' : 'reka-open')?.focus();
            }
          } }, () => [h(DialogTitle, {}, () => 'Edit profile'),
            h(DialogDescription, {}, () => 'A fixed example; no data is saved.'),
            h('label', { for: 'profile-name' }, 'Display name'), h('input', { id: 'profile-name' }),
            h(DialogClose, { asChild: true }, () => h('button', { id: 'reka-close' }, 'Close'))])])])]);
  } }).mount('#app');
}
