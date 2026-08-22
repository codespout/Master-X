import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';

let wss = null;

export function initWs(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket, req) => {
    let userId = null;
    try {
      const u = new URL(req.url, 'http://localhost');
      const token = u.searchParams.get('token');
      if (token) userId = jwt.verify(token, JWT_SECRET).id;
    } catch {
      userId = null;
    }
    socket.userId = userId;
    socket.send(JSON.stringify({ type: 'hello', data: { connected: true } }));
  });
  return wss;
}

export function broadcast(type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data });
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
}

export function sendToUser(userId, type, data) {
  if (!wss || !userId) return;
  const msg = JSON.stringify({ type, data });
  for (const c of wss.clients) {
    if (c.readyState === 1 && c.userId === userId) c.send(msg);
  }
}
