<script>
  import { createDialog } from '@melt-ui/svelte';
  const { elements: { trigger, overlay, content, title, close, portal }, states: { open } } = createDialog();
</script>
<h1>Melt UI dialog</h1><button {...$trigger} use:trigger>Edit profile</button>
<div {...$portal} use:portal>
  {#if $open}
    <div class="melt-overlay" {...$overlay} use:overlay></div>
    <section class="melt-panel" {...$content} use:content>
      <h2 {...$title} use:title>Edit profile</h2><label>Display name<input value="Ada" /></label><button {...$close} use:close>Close</button>
    </section>
  {/if}
</div>
