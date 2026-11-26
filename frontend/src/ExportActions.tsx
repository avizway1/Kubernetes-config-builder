import { useState } from 'react';

// Copy and Download for the file a lesson or lab shows. Both use exactly the text on screen.
export function ExportActions({ text, filename }: { text: string; filename: string }) {
  const [message, setMessage] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied to clipboard.');
    } catch {
      setMessage('Could not copy. Use Download to save the file.');
    }
  }

  function download() {
    setMessage('');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/yaml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="export-actions" aria-label="Copy or download the file">
      <button type="button" disabled={!text} onClick={copy}>Copy</button>
      <button type="button" disabled={!text} onClick={download}>Download</button>
      <span role="status">{message}</span>
    </div>
  );
}
