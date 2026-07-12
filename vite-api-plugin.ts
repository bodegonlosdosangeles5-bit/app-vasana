/**
 * Vite plugin that emulates Vercel serverless functions locally.
 * Maps requests to /api/<name> → ./api/<name>.ts handler(req, res).
 */
import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

// Manually load .env into process.env for the API handlers
// (Vite only exposes VITE_* to the client, but our serverless functions need all vars)
function loadEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function vercelApiPlugin(): Plugin {
  return {
    name: 'vite-vercel-api',
    configureServer(server) {
      // Load environment variables for the API handlers
      const root = process.cwd();
      loadEnvFile(path.resolve(root, '.env'));
      loadEnvFile(path.resolve(root, '.env.local'));

      server.middlewares.use(async (req, res, next) => {
        // Only intercept /api/* requests
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        // Parse the URL to extract route name and query params
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const routeName = parsedUrl.pathname.replace('/api/', '').replace(/\/$/, '');

        if (!routeName) {
          return next();
        }

        const apiFilePath = path.resolve(process.cwd(), 'api', `${routeName}.ts`);

        try {
          // Use Vite's ssrLoadModule which handles TypeScript and
          // resolves .js imports to .ts files properly
          const mod = await server.ssrLoadModule(`/api/${routeName}.ts`);
          const handler = mod.default;

          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: `API route /api/${routeName} does not export a default handler` }));
            return;
          }

          // Build a mock Vercel-style request object
          const query: Record<string, string> = {};
          parsedUrl.searchParams.forEach((value, key) => {
            query[key] = value;
          });

          // Read the request body for POST/PUT/PATCH
          let body: any = undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
            body = await new Promise<any>((resolve, reject) => {
              let data = '';
              req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
              req.on('end', () => {
                try {
                  resolve(data ? JSON.parse(data) : undefined);
                } catch {
                  resolve(data);
                }
              });
              req.on('error', reject);
            });
          }

          const mockReq = {
            method: req.method,
            headers: req.headers,
            url: req.url,
            query,
            body,
            socket: (req as any).socket,
          };

          const mockRes = {
            statusCode: 200,
            _headers: {} as Record<string, string>,
            setHeader(name: string, value: any) {
              mockRes._headers[name.toLowerCase()] = String(value);
            },
            status(code: number) {
              mockRes.statusCode = code;
              return mockRes;
            },
            json(data: any) {
              // Apply collected headers
              for (const [k, v] of Object.entries(mockRes._headers)) {
                res.setHeader(k, v);
              }
              res.setHeader('content-type', 'application/json');
              res.statusCode = mockRes.statusCode;
              res.end(JSON.stringify(data));
            },
            end(data?: string) {
              for (const [k, v] of Object.entries(mockRes._headers)) {
                res.setHeader(k, v);
              }
              res.statusCode = mockRes.statusCode;
              res.end(data);
            },
          };

          await handler(mockReq, mockRes);
        } catch (err: any) {
          console.error(`[vite-api-plugin] Error executing /api/${routeName}:`, err);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: `Server error in /api/${routeName}: ${err.message}`
          }));
        }
      });
    },
  };
}
