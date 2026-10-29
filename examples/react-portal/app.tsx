import { StrictMode, useLayoutEffect, useRef, useState, type RefObject, type KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import './style.css';

const appRoot = document.getElementById('app')!;
const portalRoot = document.getElementById('portal-root')!;
const defect = new URLSearchParams(location.search).get('defect');

function ProfileDialog({ opener, onClose }: { opener: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const name = useRef<HTMLInputElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    appRoot.inert = true;
    (defect === 'initial-focus' ? close.current : name.current)?.focus();
    return () => {
      appRoot.inert = false;
      if (defect !== 'return-focus') opener.current?.focus();
    };
  }, [opener]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === name.current) {
        event.preventDefault(); close.current?.focus();
      } else if (!event.shiftKey && document.activeElement === close.current) {
        event.preventDefault(); name.current?.focus();
      }
    }
  };
  return createPortal(
    <div className="backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="profile-title" onKeyDown={onKeyDown}>
        <p className="eyebrow">Rendered outside the app root</p>
        <h2 id="profile-title">Edit profile</h2>
        <p>Tab and Shift+Tab stay inside. Escape closes the dialog.</p>
        <label htmlFor="display-name">Display name</label>
        <input ref={name} id="display-name" defaultValue="Sample user" autoComplete="off" />
        <button ref={close} onClick={onClose}>Close</button>
      </section>
    </div>, portalRoot,
  );
}

function App() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const label = defect === 'initial-focus' ? 'Wrong initial focus' : defect === 'return-focus' ? 'Lost return focus' : 'Corrected dialog';
  return <main>
    <p className="eyebrow">KeyTrail / React portal</p>
    <h1>A small journey.<br />A visible difference.</h1>
    <p className="intro">The same keyboard contract checks a corrected dialog and two deliberate defects.</p>
    <div className="card">
      <span className={defect ? 'badge broken' : 'badge'}>{label}</span>
      <h2>Start with your keyboard</h2>
      <p>Tab to Edit profile, then press Enter. The dialog lives in a sibling DOM root; the application owns all focus behavior.</p>
      <button ref={opener} onClick={() => setOpen(true)}>Edit profile</button>
      <ol className="journey"><li>Enter</li><li>Focus + Tab cycle</li><li>Escape</li><li>Return focus</li></ol>
    </div>
    <nav aria-label="Example variants">
      <a href="/">Corrected dialog</a>
      <a href="/?defect=initial-focus">Wrong initial focus</a>
      <a href="/?defect=return-focus">Lost return focus</a>
    </nav>
    <p className="note">Synthetic teaching fixture. Passing this journey is not a complete accessibility audit.</p>
    {open && <ProfileDialog opener={opener} onClose={() => setOpen(false)} />}
  </main>;
}

createRoot(appRoot).render(<StrictMode><App /></StrictMode>);
