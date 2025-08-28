import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

/**
 * WebSocketTester - A modern, lightweight WebSocket tester UI.
 * Features:
 * - Connect/disconnect to a user-supplied WebSocket URL
 * - Send text or JSON messages
 * - Real-time display of sent/received messages with timestamps
 * - Clear log functionality
 * - Connection status and error notifications
 * - Light theme modern styling using CSS variables
 * - Snippets panel for quick message insertion and user-saved snippets
 * - Saved connection URLs and saved templates (re-usable message skeletons)
 */

// Utility: get timestamp string
const ts = () => new Date().toLocaleTimeString();

// Types for log entries
const DIRECTION = {
  SENT: 'sent',
  RECEIVED: 'received',
  SYSTEM: 'system',
};

// Default example snippets
const DEFAULT_SNIPPETS = [
  { id: 'ex-hello', name: 'Hello text', content: 'Hello, WebSocket!', type: 'text' },
  { id: 'ex-ping', name: 'JSON Ping', content: JSON.stringify({ type: 'ping' }, null, 2), type: 'json' },
  { id: 'ex-echo', name: 'Echo JSON', content: JSON.stringify({ action: 'echo', value: 'sample' }, null, 2), type: 'json' },
  { id: 'ex-time', name: 'Time request', content: JSON.stringify({ cmd: 'time' }, null, 2), type: 'json' },
];

// Storage keys
const SNIPPETS_KEY = 'wsTester.snippets.v1';
const URLS_KEY = 'wsTester.urls.v1';
const TEMPLATES_KEY = 'wsTester.templates.v1';

// PUBLIC_INTERFACE
function App() {
  /** Theme handling (light only by default per requirement) */
  const [theme] = useState('light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /** WebSocket state */
  const [url, setUrl] = useState('');
  const [isSecure, setIsSecure] = useState(true);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected
  const [error, setError] = useState('');

  /** Message compose */
  const [message, setMessage] = useState('');
  const [isJson, setIsJson] = useState(false);

  /** Log state */
  const [log, setLog] = useState([]);
  const logEndRef = useRef(null);

  /** Snippets (quick samples and user saved snippets, persisted) */
  const [snippets, setSnippets] = useState([]);
  const [snippetName, setSnippetName] = useState('');

  /** Saved URLs (with optional labels) */
  const [savedUrls, setSavedUrls] = useState([]);
  const [urlLabel, setUrlLabel] = useState('');

  /** Templates (re-usable message skeletons distinct from snippets) */
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');

  const protocolHint = useMemo(() => (isSecure ? 'wss://' : 'ws://'), [isSecure]);

  // Load persisted data on mount
  useEffect(() => {
    try {
      const rawSnippets = localStorage.getItem(SNIPPETS_KEY);
      if (rawSnippets) {
        const parsed = JSON.parse(rawSnippets);
        const withIds = parsed.map((s) => ({ id: s.id || crypto.randomUUID(), ...s }));
        setSnippets(withIds);
      } else {
        setSnippets(DEFAULT_SNIPPETS);
      }
    } catch {
      setSnippets(DEFAULT_SNIPPETS);
    }

    try {
      const rawUrls = localStorage.getItem(URLS_KEY);
      if (rawUrls) {
        const parsed = JSON.parse(rawUrls);
        const withIds = parsed.map((u) => ({ id: u.id || crypto.randomUUID(), ...u }));
        setSavedUrls(withIds);
      }
    } catch {
      // ignore
    }

    try {
      const rawTemplates = localStorage.getItem(TEMPLATES_KEY);
      if (rawTemplates) {
        const parsed = JSON.parse(rawTemplates);
        const withIds = parsed.map((t) => ({ id: t.id || crypto.randomUUID(), ...t }));
        setTemplates(withIds);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist user snippets to localStorage (exclude defaults)
  useEffect(() => {
    const userSnippets = snippets.filter((s) => !s.id?.startsWith('ex-'));
    try {
      localStorage.setItem(SNIPPETS_KEY, JSON.stringify(userSnippets));
    } catch {
      // ignore storage errors
    }
  }, [snippets]);

  // Persist saved URLs
  useEffect(() => {
    try {
      localStorage.setItem(URLS_KEY, JSON.stringify(savedUrls));
    } catch {
      // ignore
    }
  }, [savedUrls]);

  // Persist templates
  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    } catch {
      // ignore
    }
  }, [templates]);

  // Auto-scroll to bottom on new log entries
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        wsRef.current?.close(1000, 'Component unmounted');
      } catch {
        // ignore
      }
    };
  }, []);

  const addLog = (entry) => {
    setLog((prev) => [...prev, { id: crypto.randomUUID(), time: ts(), ...entry }]);
  };

  const normalizeUrl = (u) => {
    if (!u) return '';
    const trimmed = u.trim();
    if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
    return `${protocolHint}${trimmed}`;
  };

  // PUBLIC_INTERFACE
  const connect = () => {
    const target = normalizeUrl(url);
    setError('');
    if (!target) {
      setError('Please enter a valid WebSocket URL.');
      addLog({ type: DIRECTION.SYSTEM, text: 'No URL provided.' });
      return;
    }
    try {
      addLog({ type: DIRECTION.SYSTEM, text: `Connecting to ${target} ...` });
      setStatus('connecting');
      const ws = new WebSocket(target);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        addLog({ type: DIRECTION.SYSTEM, text: `Connected to ${target}` });
      };

      ws.onmessage = (evt) => {
        let display = evt.data;
        // Attempt to prettify JSON if applicable
        try {
          const maybe = JSON.parse(evt.data);
          display = JSON.stringify(maybe, null, 2);
        } catch {
          // keep as is
        }
        addLog({ type: DIRECTION.RECEIVED, text: display });
      };

      ws.onerror = (evt) => {
        setError('WebSocket error occurred. Check the console or server.');
        addLog({ type: DIRECTION.SYSTEM, text: `Error: ${evt?.message || 'An error occurred'}` });
      };

      ws.onclose = (evt) => {
        setStatus('disconnected');
        const reason = evt.reason || 'Connection closed';
        addLog({ type: DIRECTION.SYSTEM, text: `Disconnected (${evt.code}) - ${reason}` });
      };
    } catch (e) {
      setStatus('disconnected');
      setError(`Failed to connect: ${e.message}`);
      addLog({ type: DIRECTION.SYSTEM, text: `Failed to connect: ${e.message}` });
    }
  };

  // PUBLIC_INTERFACE
  const disconnect = () => {
    try {
      wsRef.current?.close(1000, 'User disconnect');
    } catch (e) {
      // ignore
    } finally {
      setStatus('disconnected');
      addLog({ type: DIRECTION.SYSTEM, text: 'Disconnected by user' });
    }
  };

  // PUBLIC_INTERFACE
  const sendMessage = () => {
    setError('');
    if (status !== 'connected' || !wsRef.current) {
      setError('Not connected to a WebSocket server.');
      addLog({ type: DIRECTION.SYSTEM, text: 'Cannot send: not connected' });
      return;
    }
    if (!message.trim()) return;

    let payload = message;
    if (isJson) {
      try {
        // Allow either object/array or string JSON input
        const parsed = JSON.parse(message);
        payload = JSON.stringify(parsed);
      } catch (e) {
        setError(`Invalid JSON: ${e.message}`);
        addLog({ type: DIRECTION.SYSTEM, text: `Invalid JSON: ${e.message}` });
        return;
      }
    }

    try {
      wsRef.current.send(payload);
      // Pretty log JSON
      let display = payload;
      if (isJson) {
        try {
          display = JSON.stringify(JSON.parse(payload), null, 2);
        } catch {
          // ignore, keep raw
        }
      }
      addLog({ type: DIRECTION.SENT, text: display });
    } catch (e) {
      setError(`Send failed: ${e.message}`);
      addLog({ type: DIRECTION.SYSTEM, text: `Send failed: ${e.message}` });
    }
  };

  // PUBLIC_INTERFACE
  const clearLog = () => {
    setLog([]);
    addLog({ type: DIRECTION.SYSTEM, text: 'Log cleared' });
  };

  // PUBLIC_INTERFACE
  const applySnippet = (snippet) => {
    // Insert content and set JSON toggle based on snippet type
    setMessage(snippet.content);
    setIsJson(snippet.type === 'json');
  };

  // PUBLIC_INTERFACE
  const deleteSnippet = (id) => {
    // Allow deletion only for user-defined snippets (not default examples)
    setSnippets((prev) => prev.filter((s) => s.id !== id || s.id.startsWith('ex-')));
  };

  // PUBLIC_INTERFACE
  const saveCurrentAsSnippet = () => {
    const content = message.trim();
    if (!content) return;
    const type = isJson ? 'json' : 'text';
    const name = snippetName.trim() || (isJson ? 'Saved JSON' : 'Saved text');
    const newSnippet = { id: crypto.randomUUID(), name, content, type };
    setSnippets((prev) => [...prev, newSnippet]);
    setSnippetName('');
  };

  // PUBLIC_INTERFACE
  const saveCurrentUrl = () => {
    const u = url.trim();
    if (!u) return;
    const entry = {
      id: crypto.randomUUID(),
      label: urlLabel.trim() || u,
      url: u,
      secure: isSecure,
    };
    setSavedUrls((prev) => {
      // avoid exact duplicate url+secure combos if already saved
      const exists = prev.some((x) => x.url === entry.url && x.secure === entry.secure && x.label === entry.label);
      if (exists) return prev;
      return [...prev, entry];
    });
    setUrlLabel('');
  };

  // PUBLIC_INTERFACE
  const selectSavedUrl = (entry) => {
    setUrl(entry.url);
    setIsSecure(entry.secure ?? true);
  };

  // PUBLIC_INTERFACE
  const deleteSavedUrl = (id) => {
    setSavedUrls((prev) => prev.filter((x) => x.id !== id));
  };

  // PUBLIC_INTERFACE
  const saveCurrentAsTemplate = () => {
    const content = message.trim();
    if (!content) return;
    const name = templateName.trim() || (isJson ? 'New JSON template' : 'New text template');
    const newItem = {
      id: crypto.randomUUID(),
      name,
      content,
      type: isJson ? 'json' : 'text',
    };
    setTemplates((prev) => [...prev, newItem]);
    setTemplateName('');
  };

  // PUBLIC_INTERFACE
  const applyTemplate = (tpl) => {
    setMessage(tpl.content);
    setIsJson(tpl.type === 'json');
  };

  // PUBLIC_INTERFACE
  const deleteTemplate = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const allSnippets = useMemo(() => {
    // Merge defaults and user snippets for display
    const user = snippets.filter((s) => !s.id?.startsWith('ex-'));
    const defaults = DEFAULT_SNIPPETS;
    return [...defaults, ...user];
  }, [snippets]);

  const connected = status === 'connected';
  const connecting = status === 'connecting';

  return (
    <div className="ws-app">
      <nav className="topbar">
        <div className="brand">
          <span className="dot" />
          WebSocket Tester
        </div>
        <div className={`status ${status}`}>
          <span className="status-dot" />
          {status}
        </div>
      </nav>

      <main className="container">
        <section className="panel">
          <div className="row">
            <div className="input-group url">
              <label htmlFor="ws-url">WebSocket URL</label>
              <div className="url-input">
                <span className="protocol">{protocolHint}</span>
                <input
                  id="ws-url"
                  type="text"
                  placeholder="echo.websocket.events"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={connecting || connected}
                />
              </div>
            </div>

            <div className="controls">
              <div className="switch">
                <input
                  id="secure"
                  type="checkbox"
                  checked={isSecure}
                  disabled={connecting || connected}
                  onChange={(e) => setIsSecure(e.target.checked)}
                />
                <label htmlFor="secure">Secure (wss)</label>
              </div>

              {!connected ? (
                <button
                  className="btn primary"
                  onClick={connect}
                  disabled={connecting}
                  aria-label="Connect to WebSocket"
                >
                  {connecting ? 'Connecting…' : 'Connect'}
                </button>
              ) : (
                <button
                  className="btn danger"
                  onClick={disconnect}
                  aria-label="Disconnect from WebSocket"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="alert error" role="alert">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Saved URLs Panel */}
          <div className="snippets">
            <div className="snippets-header">
              <h3>Saved Connections</h3>
              <span className="hint">Save, select, or manage WebSocket endpoints</span>
            </div>

            <div className="snippets-body">
              {savedUrls.length === 0 ? (
                <div className="empty">No saved URLs yet. Save the current input to reuse later.</div>
              ) : (
                <div className="snippet-grid">
                  {savedUrls.map((entry) => (
                    <div key={entry.id} className="snippet-card" title={entry.label || entry.url}>
                      <div className="snippet-meta">
                        <span className="badge">{entry.secure ? 'wss' : 'ws'}</span>
                        <span className="snippet-name">{entry.label || entry.url}</span>
                      </div>
                      <pre className="snippet-content">{entry.url}</pre>
                      <div className="snippet-actions">
                        <button
                          className="btn ghost"
                          onClick={() => selectSavedUrl(entry)}
                          aria-label={`Select URL ${entry.label || entry.url}`}
                        >
                          Use
                        </button>
                        <button
                          className="btn"
                          onClick={() => deleteSavedUrl(entry.id)}
                          aria-label={`Delete URL ${entry.label || entry.url}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="snippet-save">
              <div className="input-row">
                <div className="input-group">
                  <label htmlFor="url-label">Save current URL</label>
                  <input
                    id="url-label"
                    type="text"
                    placeholder="Optional label (e.g., Production, Local dev)"
                    value={urlLabel}
                    onChange={(e) => setUrlLabel(e.target.value)}
                    disabled={connecting || connected}
                  />
                </div>
                <button
                  className="btn"
                  onClick={saveCurrentUrl}
                  disabled={!url.trim() || connecting || connected}
                  aria-label="Save current URL"
                >
                  Save URL
                </button>
              </div>
            </div>
          </div>

          {/* Snippets Panel */}
          <div className="snippets">
            <div className="snippets-header">
              <h3>Snippets</h3>
              <span className="hint">Quickly insert example or saved messages</span>
            </div>

            <div className="snippets-body">
              {allSnippets.length === 0 ? (
                <div className="empty">No snippets available.</div>
              ) : (
                <div className="snippet-grid">
                  {allSnippets.map((snip) => (
                    <div key={snip.id} className="snippet-card" title={snip.name}>
                      <div className="snippet-meta">
                        <span className={`badge ${snip.type === 'json' ? 'badge-json' : 'badge-text'}`}>
                          {snip.type}
                        </span>
                        <span className="snippet-name">{snip.name}</span>
                      </div>
                      <pre className="snippet-content">{snip.content}</pre>
                      <div className="snippet-actions">
                        <button
                          className="btn ghost"
                          onClick={() => applySnippet(snip)}
                          aria-label={`Insert snippet ${snip.name}`}
                        >
                          Insert
                        </button>
                        {!snip.id.startsWith('ex-') && (
                          <button
                            className="btn"
                            onClick={() => setSnippets((prev) => prev.filter((s) => s.id !== snip.id))}
                            aria-label={`Delete snippet ${snip.name}`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="snippet-save">
              <div className="input-row">
                <div className="input-group">
                  <label htmlFor="snippet-name">Save current message as snippet</label>
                  <input
                    id="snippet-name"
                    type="text"
                    placeholder="Optional name/label (e.g., My Auth Message)"
                    value={snippetName}
                    onChange={(e) => setSnippetName(e.target.value)}
                  />
                </div>
                <button
                  className="btn"
                  onClick={saveCurrentAsSnippet}
                  disabled={!message.trim()}
                  aria-label="Save current message as snippet"
                >
                  Save Snippet
                </button>
              </div>
            </div>
          </div>

          {/* Templates Panel */}
          <div className="snippets">
            <div className="snippets-header">
              <h3>Templates</h3>
              <span className="hint">Reusable message skeletons you can insert and customize</span>
            </div>

            <div className="snippets-body">
              {templates.length === 0 ? (
                <div className="empty">No templates saved yet. Create one from the current message.</div>
              ) : (
                <div className="snippet-grid">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="snippet-card" title={tpl.name}>
                      <div className="snippet-meta">
                        <span className={`badge ${tpl.type === 'json' ? 'badge-json' : 'badge-text'}`}>
                          {tpl.type}
                        </span>
                        <span className="snippet-name">{tpl.name}</span>
                      </div>
                      <pre className="snippet-content">{tpl.content}</pre>
                      <div className="snippet-actions">
                        <button
                          className="btn ghost"
                          onClick={() => applyTemplate(tpl)}
                          aria-label={`Insert template ${tpl.name}`}
                        >
                          Insert
                        </button>
                        <button
                          className="btn"
                          onClick={() => deleteTemplate(tpl.id)}
                          aria-label={`Delete template ${tpl.name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="snippet-save">
              <div className="input-row">
                <div className="input-group">
                  <label htmlFor="template-name">Save current message as template</label>
                  <input
                    id="template-name"
                    type="text"
                    placeholder="Template name (e.g., Auth skeleton, Subscription)"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                <button
                  className="btn"
                  onClick={saveCurrentAsTemplate}
                  disabled={!message.trim()}
                  aria-label="Save current message as template"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>

          <div className="compose">
            <div className="input-group">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                rows={4}
                placeholder={isJson ? '{ "type": "ping" }' : 'Hello, WebSocket!'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={!connected}
              />
            </div>

            <div className="compose-actions">
              <div className="switch">
                <input
                  id="json"
                  type="checkbox"
                  checked={isJson}
                  onChange={(e) => setIsJson(e.target.checked)}
                  disabled={!connected}
                />
                <label htmlFor="json">JSON</label>
              </div>
              <div className="actions">
                <button className="btn ghost" onClick={clearLog}>Clear Log</button>
                <button className="btn accent" onClick={sendMessage} disabled={!connected || !message.trim()}>
                  Send
                </button>
              </div>
            </div>
          </div>

          <div className="log">
            <div className="log-header">
              <h3>Message Log</h3>
              <span className="hint">Real-time messages with timestamps</span>
            </div>
            <div className="log-body" role="log" aria-live="polite">
              {log.length === 0 ? (
                <div className="empty">No messages yet. Connect to a server and start sending.</div>
              ) : (
                log.map((entry) => (
                  <div key={entry.id} className={`log-row ${entry.type}`}>
                    <div className="meta">
                      <span className="badge">{entry.type}</span>
                      <span className="time">{entry.time}</span>
                    </div>
                    <pre className="content">{entry.text}</pre>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>Tip: Try echo.websocket.events for a public echo server.</span>
      </footer>
    </div>
  );
}

export default App;
