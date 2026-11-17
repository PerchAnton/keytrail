import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactTabs from '@cypress-design/react-tabs';
import VueTabs from '@cypress-design/vue-tabs';
import { createApp, h, ref } from 'vue';
const items = ['one', 'two', 'three'];
const tabs = items.map(id => ({ id, label: id, 'aria-controls': `${id}-panel` }));
function ReactExample({ initial }) {
  const [active, setActive] = useState(initial);
  return <><button id="before">Before tabs</button>
    <ReactTabs tabs={tabs} activeId={active} aria-label="Example sections" onSwitch={tab => setActive(tab.id)}/>
    {items.map(id => <section key={id} id={`${id}-panel`} role="tabpanel" aria-labelledby={id} hidden={active !== id} tabIndex={0}>{id} content</section>)}
    <button id="after">After tabs</button></>;
}
export function mountCypressTabs({ framework, corrected }) {
  const initial = corrected ? 'one' : undefined;
  if (framework === 'react') createRoot(document.getElementById('app')).render(<ReactExample initial={initial}/>);
  else createApp({ setup() {
    const active = ref(initial);
    return () => h('div', [h('button', { id: 'before' }, 'Before tabs'),
      h(VueTabs, { tabs, activeId: active.value, 'aria-label': 'Example sections', onSwitch: tab => { active.value = tab.id; } }),
      ...items.map(id => h('section', { id: `${id}-panel`, role: 'tabpanel', 'aria-labelledby': id, hidden: active.value !== id, tabindex: 0 }, `${id} content`)),
      h('button', { id: 'after' }, 'After tabs')]);
  } }).mount('#app');
}
