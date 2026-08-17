import { getToken } from './api';

let socket = null;
let listeners = new Set();
let retryTimer = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function handleMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }
  for (const fn of listeners) fn(msg);
}

export function connect() {
  if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;
  const token = getToken();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  socket = new WebSocket(url);
  socket.onmessage = handleMessage;
  socket.onclose = () => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 4000);
  };
}

export function disconnect() {
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  clearTimeout(retryTimer);
}
