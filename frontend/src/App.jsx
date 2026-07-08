import React, { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// In docker-compose the browser talks to the backend via its host-mapped port,
// not the internal service name (the browser isn't part of the compose network).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function StatusBadge({ status }) {
  const styles = {
    up: { background: '#e6f7ed', color: '#0a7d3c', label: 'UP' },
    down: { background: '#fdecea', color: '#c0392b', label: 'DOWN' },
    pending: { background: '#f0f0f0', color: '#777', label: 'PENDING' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span
      style={{
        background: s.background,
        color: s.color,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.5,
      }}
    >
      {s.label}
    </span>
  );
}

export default function App() {
  const [urls, setUrls] = useState([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUrls = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/urls`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUrls(data);
      setError('');
    } catch (err) {
      setError(`Could not reach backend at ${API_URL}. Is it running?`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUrls();
    const socket = io(API_URL);
    
    socket.on('status_update', () => {
      fetchUrls();
    });

    return () => socket.disconnect();
  }, [fetchUrls]);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add URL');
      setName('');
      setUrl('');
      fetchUrls();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    await fetch(`${API_URL}/api/urls/${id}`, { method: 'DELETE' });
    fetchUrls();
  }

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: 900,
        margin: '0 auto',
        padding: '32px 20px',
        color: '#1a1a1a',
      }}
    >
      <h1 style={{ marginBottom: 4 }}>Uptime Monitor</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Checks run automatically every ~60s. This dashboard updates in real-time.
      </p>

      <form
        onSubmit={handleAdd}
        style={{ display: 'flex', gap: 8, margin: '24px 0', flexWrap: 'wrap' }}
      >
        <input
          placeholder="Display name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6, flex: '1 1 180px' }}
        />
        <input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6, flex: '2 1 260px' }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 18px',
            background: '#1a1a1a',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Add URL
        </button>
      </form>

      {error && (
        <div style={{ background: '#fdecea', color: '#c0392b', padding: 10, borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : urls.length === 0 ? (
        <p style={{ color: '#666' }}>No URLs monitored yet. Add one above.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
              <th style={{ padding: '8px 4px' }}>Name</th>
              <th style={{ padding: '8px 4px' }}>URL</th>
              <th style={{ padding: '8px 4px' }}>Status</th>
              <th style={{ padding: '8px 4px' }}>HTTP Code</th>
              <th style={{ padding: '8px 4px' }}>Response Time</th>
              <th style={{ padding: '8px 4px' }}>Last Checked</th>
              <th style={{ padding: '8px 4px' }}></th>
            </tr>
          </thead>
          <tbody>
            {urls.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 4px' }}>{u.name}</td>
                <td style={{ padding: '10px 4px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <a href={u.url} target="_blank" rel="noreferrer">{u.url}</a>
                </td>
                <td style={{ padding: '10px 4px' }}><StatusBadge status={u.status} /></td>
                <td style={{ padding: '10px 4px' }}>{u.status_code ?? '—'}</td>
                <td style={{ padding: '10px 4px' }}>{u.response_time_ms != null ? `${u.response_time_ms} ms` : '—'}</td>
                <td style={{ padding: '10px 4px', color: '#666', fontSize: 13 }}>
                  {u.last_checked_at ? new Date(u.last_checked_at + 'Z').toLocaleTimeString() : 'pending...'}
                </td>
                <td style={{ padding: '10px 4px' }}>
                  <button
                    onClick={() => handleDelete(u.id)}
                    style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
