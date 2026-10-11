/**
 * Tests for the OPTIONAL MCP bearer auth middleware (apps/api/src/mcp/auth.ts).
 *
 * Proven through a real Express app with supertest:
 * - when MCP_API_KEY IS configured: 401 without an Authorization header /
 *   with a wrong scheme / wrong token; 200 + next() with the correct
 *   `Authorization: Bearer <MCP_API_KEY>`; WWW-Authenticate challenge on 401
 * - when MCP_API_KEY is unset or empty: auth is DISABLED — requests pass
 *   through without a token (explicit user choice, replaces fail-closed)
 */
import express, { Express } from 'express';
import request from 'supertest';
import { mcpAuth, MCP_API_KEY_ENV_VAR } from '../mcp/auth';

const TEST_KEY = 'test-mcp-api-key-0123456789';

function buildApp(): Express {
  const app = express();
  app.use(mcpAuth);
  app.get('/probe', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('mcpAuth — fail-closed bearer auth', () => {
  let app: Express;
  const originalKey = process.env[MCP_API_KEY_ENV_VAR];

  beforeEach(() => {
    app = buildApp();
    process.env[MCP_API_KEY_ENV_VAR] = TEST_KEY;
  });

  afterAll(() => {
    // Restore the environment for other suites.
    if (originalKey === undefined) {
      delete process.env[MCP_API_KEY_ENV_VAR];
    } else {
      process.env[MCP_API_KEY_ENV_VAR] = originalKey;
    }
  });

  describe('when MCP_API_KEY is configured', () => {
    it('accepts a request with the correct bearer token and calls next()', async () => {
      const res = await request(app)
        .get('/probe')
        .set('Authorization', `Bearer ${TEST_KEY}`)
        .expect(200);

      expect(res.body).toEqual({ ok: true });
    });

    it('rejects 401 when the Authorization header is missing', async () => {
      const res = await request(app).get('/probe').expect(401);

      expect(res.body.error).toBeTruthy();
      expect(res.headers['www-authenticate']).toContain('Bearer');
    });

    it('rejects 401 when the bearer token does not match MCP_API_KEY', async () => {
      const res = await request(app)
        .get('/probe')
        .set('Authorization', 'Bearer wrong-token')
        .expect(401);

      expect(res.body.error).toBeTruthy();
      expect(res.headers['www-authenticate']).toContain('Bearer');
    });

    it('rejects 401 when the Authorization scheme is not Bearer', async () => {
      await request(app)
        .get('/probe')
        .set('Authorization', `Basic ${Buffer.from('user:pass').toString('base64')}`)
        .expect(401);

      await request(app).get('/probe').set('Authorization', TEST_KEY).expect(401);
    });

    it('accepts the Bearer scheme case-insensitively (RFC 7235)', async () => {
      await request(app)
        .get('/probe')
        .set('Authorization', `bearer ${TEST_KEY}`)
        .expect(200);
    });
  });

  describe('auth disabled (optional — explicit user choice)', () => {
    it('lets every request through when MCP_API_KEY is unset — even without a token', async () => {
      delete process.env[MCP_API_KEY_ENV_VAR];

      await request(app).get('/probe').expect(200);
      await request(app)
        .get('/probe')
        .set('Authorization', 'Bearer whatever')
        .expect(200);
    });

    it('lets requests through when MCP_API_KEY is empty or whitespace', async () => {
      process.env[MCP_API_KEY_ENV_VAR] = '';
      await request(app).get('/probe').expect(200);

      process.env[MCP_API_KEY_ENV_VAR] = '   ';
      await request(app).get('/probe').expect(200);
    });
  });
});
