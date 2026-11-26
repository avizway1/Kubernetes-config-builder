import { useState } from 'react';

// A command or file learners copy exactly as shown.
export function CommandBlock({ text, label = 'Copy', name }: { text: string; label?: string; name?: string }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied');
    } catch {
      setMessage('Select the text and copy it');
    }
  }
  return (
    <div className="command-block">
      <pre><code>{text}</code></pre>
      <button type="button" onClick={copy}>{label}<span className="visually-hidden">{name ? ` ${name}` : ''}</span></button>
      <span role="status" className="command-status">{message}</span>
    </div>
  );
}
