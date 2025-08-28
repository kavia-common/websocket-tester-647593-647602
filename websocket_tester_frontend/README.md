# WebSocket Tester Frontend

A lightweight React application to test and interact with WebSocket servers. Connect to any WebSocket URL, send text or JSON messages, and view a real-time log of sent/received data.

## Features

- Connect to a WebSocket server via user-supplied URL (toggle ws/wss).
- Send custom text and JSON messages (with JSON validation).
- Receive and display messages in real time (pretty prints JSON).
- Connection status and error notifications.
- Log with timestamps, message direction badges, and clear log.
- Modern, responsive, light theme UI without heavy frameworks.

## Quick Start

In the project directory, run:

```bash
npm install
npm start
```

Open http://localhost:3000 to view in your browser.

## Usage

1. Enter a WebSocket host or full URL. Example: `echo.websocket.events`
   - Use the “Secure (wss)” switch to toggle between `wss://` and `ws://` if you provide only host/path.
   - If you enter a full URL starting with ws:// or wss://, it will be used as-is.
2. Click “Connect”. The status indicator will change on connect/disconnect.
3. Type a message in the Message box. Enable the JSON switch to validate and pretty-print JSON.
4. Click “Send” to send to the server.
5. All sent and received messages appear in the Message Log with timestamps.
6. Use “Clear Log” to clear the display.

Tip: Try the public echo server: `echo.websocket.events`

## Notes

- No environment configuration is required.
- This app uses the native WebSocket browser API.
- Errors are displayed inline under the URL controls.

## Scripts

- `npm start` - Runs the app in development mode.
- `npm test` - Launches the test runner.
- `npm run build` - Builds the app for production.

## License

MIT
