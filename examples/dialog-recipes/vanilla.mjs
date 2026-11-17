export async function mount(library) {
  if (library === 'uikit') {
    await import('uikit/dist/css/uikit.css');
    await import('uikit');
    document.querySelector('#app').innerHTML = `<h1>UIkit modal</h1><button type="button" uk-toggle="target: #profile">Edit profile</button>
      <div id="profile" uk-modal aria-labelledby="title"><div class="uk-modal-dialog uk-modal-body" aria-labelledby="title">
      <h2 id="title">Edit profile</h2><label>Display name<input autofocus value="Ada"></label><button class="uk-modal-close" type="button">Close</button></div></div>`;
    return;
  }
  if (library === 'bootstrap') { await import('bootstrap/dist/css/bootstrap.css'); await import('bootstrap'); }
  else { await import('@coreui/coreui/dist/css/coreui.css'); await import('@coreui/coreui'); }
  const prefix = library === 'bootstrap' ? 'bs' : 'coreui';
  document.querySelector('#app').innerHTML = `<h1>${library} modal</h1><button type="button" data-${prefix}-toggle="modal" data-${prefix}-target="#profile">Edit profile</button>
    <div class="modal" id="profile" tabindex="-1" aria-labelledby="title" aria-hidden="true"><div class="modal-dialog"><div class="modal-content">
    <div class="modal-header"><h2 class="modal-title" id="title">Edit profile</h2></div><div class="modal-body">
    <label>Display name<input value="Ada"></label><button type="button" data-${prefix}-dismiss="modal">Close</button></div></div></div></div>`;
}
