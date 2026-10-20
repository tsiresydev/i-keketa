import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api-client';

/**
 * Crée la connexion temps réel authentifiée par jeton JWT.
 */
export const createChatSocket = (token: string): Socket =>
  io(API_BASE_URL || undefined, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
