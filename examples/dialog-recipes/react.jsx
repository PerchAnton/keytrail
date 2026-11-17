import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from 'react-modal';
Modal.setAppElement('#app');
function App() {
  const [open, setOpen] = useState(false);
  return <><h1>React Modal</h1><button onClick={() => setOpen(true)}>Edit profile</button>
    <Modal isOpen={open} onRequestClose={() => setOpen(false)} contentLabel="Edit profile" aria={{ modal: true }}>
      <h2>Edit profile</h2><label>Display name<input defaultValue="Ada" /></label><button onClick={() => setOpen(false)}>Close</button>
    </Modal></>;
}
export function mount() { createRoot(document.querySelector('#app')).render(<App />); }
