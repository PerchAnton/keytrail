import { createApp, h, ref } from 'vue';
export async function mount(library) {
  let plugin, Dialog;
  if (library === 'vuetify') {
    await import('vuetify/styles'); const { createVuetify } = await import('vuetify'); plugin = createVuetify();
    Dialog = (await import('vuetify/components/VDialog')).VDialog;
  } else if (library === 'quasar') {
    await import('quasar/dist/quasar.css'); const q = await import('quasar'); plugin = q.Quasar; Dialog = q.QDialog;
  } else { await import('ant-design-vue/dist/reset.css'); Dialog = (await import('ant-design-vue/es/modal')).default; }
  const App = { setup() {
    const open = ref(false);
    const fields = () => h('section', { class: 'recipe-panel' }, [h('h2', { id: 'title' }, 'Edit profile'),
      h('label', ['Display name', h('input', { value: 'Ada', autofocus: library === 'quasar' })]), h('button', { onClick: () => { open.value = false; } }, 'Close')]);
    return () => h('main', [h('h1', `${library} dialog`),
      library === 'vuetify' ? h(Dialog, { modelValue: open.value, 'onUpdate:modelValue': v => { open.value = v; }, 'aria-labelledby': 'title', transition: false }, {
        activator: ({ props }) => h('button', props, 'Edit profile'), default: fields }) : [
          h('button', { onClick: () => { open.value = true; } }, 'Edit profile'),
          library === 'quasar' ? h(Dialog, { modelValue: open.value, 'onUpdate:modelValue': v => { open.value = v; }, 'aria-labelledby': 'title', transitionDuration: 0 }, fields) :
          h(Dialog, { open: open.value, onCancel: () => { open.value = false; }, footer: null, closable: false, title: 'Edit profile' }, fields)
        ]]);
  } };
  const app = createApp(App); if (plugin) app.use(plugin, {}); app.mount('#app');
}
