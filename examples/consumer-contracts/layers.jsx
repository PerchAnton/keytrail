import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Dialog } from '@base-ui/react/dialog';
import { Toaster, toast } from 'sonner';

export function mountLayers({ brokenEscape = false, expire = false }) {
  function Example() {
    const [open, setOpen] = useState(false);
    const show = useRef(null);
    const timer = useRef(null);
    const dismiss = () => {
      clearTimeout(timer.current); toast.dismiss('journey-notice'); show.current?.focus();
    };
    const showToast = () => {
      toast('Saved example', { id: 'journey-notice', duration: Infinity,
        action: { label: 'Dismiss notice', onClick: dismiss } });
      if (expire) timer.current = setTimeout(dismiss, 1200);
    };
    return <section><h1>Dialog and toast ownership</h1>
      <Dialog.Root open={open} onOpenChange={(value, details) => {
        if (!value && !brokenEscape && details.reason === 'escape-key'
          && document.activeElement?.closest('[data-sonner-toaster]')) { details.cancel(); return; }
        if (!value) { clearTimeout(timer.current); toast.dismiss('journey-notice'); }
        setOpen(value);
      }}>
        <Dialog.Trigger id="layers-open">Open settings</Dialog.Trigger>
        <Dialog.Portal><Dialog.Backdrop className="demo-overlay" />
          <Dialog.Popup className="demo-dialog" onKeyDownCapture={event => {
            if (!brokenEscape && event.key === 'Escape' && event.target.closest('[data-sonner-toaster]')) {
              event.preventDefault(); event.stopPropagation(); dismiss();
            }
          }}>
            <Dialog.Title>Settings</Dialog.Title>
            <Dialog.Description>A toast inside the active dialog's focus scope.</Dialog.Description>
            <button id="show-notice" ref={show} onClick={showToast}>Show notice</button>
            <Dialog.Close id="layers-close">Close settings</Dialog.Close>
            <Toaster hotkey={['altKey', 'KeyT']} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>;
  }
  createRoot(document.getElementById('app')).render(<Example />);
}
