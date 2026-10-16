import { describe, it, expect } from 'vitest';
import net from 'node:net';
import { findFreePort } from './port.mjs';

describe('findFreePort', () => {
  it('returns a port that can be bound on 127.0.0.1', async () => {
    const port = await findFreePort('127.0.0.1');
    expect(port).toBeGreaterThan(0);
    await new Promise((resolve, reject) => {
      const s = net.createServer();
      s.once('error', reject);
      s.listen(port, '127.0.0.1', () => s.close(() => resolve()));
    });
  });
});
