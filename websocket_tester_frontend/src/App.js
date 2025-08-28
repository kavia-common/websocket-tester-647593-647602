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
 */

// Utility: get timestamp string
const ts = () => new Date().toLocaleTimeString();

// Types for log entries
const DIRECTION = {
  SENT: 'sent',
  RECEIVED: 'received',
  SYSTEM: 'system',
};

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

  const protocolHint = useMemo(() => (isSecure ? 'wss://' : 'ws://'), [isSecure]);

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
