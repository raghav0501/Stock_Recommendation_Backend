import { onRequest } from 'firebase-functions/v2/https';
import app from './app';

// Wraps the Express app as a Firebase HTTP function.
// The local server (src/server.ts) is used for local dev; this is the deploy entry point.
export const api = onRequest(app);
