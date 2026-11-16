import React, {useId, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import * as zag from '@zag-js/dialog';
import {useMachine, normalizeProps} from '@zag-js/react';
import {DialogTrigger, Button, Modal as AriaModal, Dialog, Heading} from 'react-aria-components';
import BootstrapModal from 'react-bootstrap/Modal';

function ZagDialog() {
  const input = useRef(null);
  const service = useMachine(zag.machine, {id:useId(), initialFocusEl:()=>input.current});
  const api = zag.connect(service, normalizeProps);
  return <><button {...api.getTriggerProps()}>Edit profile</button>
    {api.open && createPortal(<div {...api.getPositionerProps()}><section {...api.getContentProps()}>
      <h2 {...api.getTitleProps()}>Edit profile</h2><p {...api.getDescriptionProps()}>A keyboard-only consumer example.</p>
      <label>Display name<input ref={input} defaultValue="Ada" /></label><button {...api.getCloseTriggerProps()}>Close</button>
    </section></div>,document.body)}</>;
}
function AriaDialog() {
  return <DialogTrigger><Button>Edit profile</Button><AriaModal><Dialog aria-label="Edit profile">
    {({close})=><><Heading slot="title">Edit profile</Heading><label>Display name<input autoFocus defaultValue="Ada" /></label><Button onPress={close}>Close</Button></>}
  </Dialog></AriaModal></DialogTrigger>;
}
function BootstrapDialog() {
  const [open,setOpen]=useState(false);
  return <><button onClick={()=>setOpen(true)}>Edit profile</button>
    <BootstrapModal show={open} onHide={()=>setOpen(false)} animation={false} aria-labelledby="bootstrap-title">
      <BootstrapModal.Header><BootstrapModal.Title id="bootstrap-title">Edit profile</BootstrapModal.Title></BootstrapModal.Header>
      <BootstrapModal.Body><label>Display name<input autoFocus defaultValue="Ada" /></label><button onClick={()=>setOpen(false)}>Close</button></BootstrapModal.Body>
    </BootstrapModal></>;
}
export function mountDialogConsumer(name) {
  const Component={zag:ZagDialog,aria:AriaDialog,bootstrap:BootstrapDialog}[name];
  if(!Component)throw new Error('Unknown dialog consumer');
  createRoot(document.getElementById('app')).render(<main><h1>{name} dialog consumer</h1><Component /></main>);
}
