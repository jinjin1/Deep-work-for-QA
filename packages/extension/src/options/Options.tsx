import React, { useEffect, useState } from 'react';

const DEFAULT_API_URL = 'http://localhost:3001/v1';
const DEFAULT_WEB_URL = 'http://localhost:3000';

export default function Options() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [webUrl, setWebUrl] = useState(DEFAULT_WEB_URL);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(['apiUrl', 'webUrl', 'apiKey'], (result) => {
      if (result.apiUrl) setApiUrl(result.apiUrl);
      if (result.webUrl) setWebUrl(result.webUrl);
      if (result.apiKey) setApiKey(result.apiKey);
    });
  }, []);

  const handleSave = () => {
    chrome.storage.sync.set({ apiUrl, webUrl, apiKey }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const handleAutoDetect = () => {
    // If user enters just an IP or hostname, auto-fill both URLs
    const input = prompt('Enter server IP or hostname (e.g. 192.168.1.50):');
    if (input) {
      const host = input.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
      setApiUrl(`http://${host}:3001/v1`);
      setWebUrl(`http://${host}:3000`);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Deep Work Settings</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        Configure the server connection for your Deep Work instance.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
          API Server URL
        </label>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder={DEFAULT_API_URL}
          style={{
            width: '100%', padding: '8px 12px', border: '1px solid #ccc',
            borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
          }}
        />
        <p style={{ color: '#999', fontSize: 11, marginTop: 4 }}>
          e.g. http://192.168.1.50:3001/v1
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
          Web Dashboard URL
        </label>
        <input
          type="text"
          value={webUrl}
          onChange={(e) => setWebUrl(e.target.value)}
          placeholder={DEFAULT_WEB_URL}
          style={{
            width: '100%', padding: '8px 12px', border: '1px solid #ccc',
            borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
          }}
        />
        <p style={{ color: '#999', fontSize: 11, marginTop: 4 }}>
          e.g. http://192.168.1.50:3000
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
          API Key (optional)
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Leave empty if not configured on server"
          style={{
            width: '100%', padding: '8px 12px', border: '1px solid #ccc',
            borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
          }}
        />
        <p style={{ color: '#999', fontSize: 11, marginTop: 4 }}>
          Only required if DEEP_WORK_API_KEY is set on the server.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          style={{
            padding: '8px 20px', background: '#2563eb', color: 'white',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
          }}
        >
          Save
        </button>
        <button
          onClick={handleAutoDetect}
          style={{
            padding: '8px 20px', background: '#f3f4f6', color: '#374151',
            border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 14,
          }}
        >
          Set by IP
        </button>
      </div>

      {saved && (
        <p style={{ color: '#16a34a', fontSize: 13, marginTop: 12 }}>
          Settings saved. Changes will take effect on next capture.
        </p>
      )}
    </div>
  );
}
