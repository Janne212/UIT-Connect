// Hạ tầng kiểm thử backend KHÔNG cần Supabase thật:
//   PostgreSQL (database uitc_test đã nạp migration) + PostgREST (cùng phần mềm Supabase chạy ở /rest/v1)
//   + proxy nhỏ đổi /rest/v1 -> PostgREST. Mỗi tài khoản thử có JWT ký bằng JWT_SECRET, nên RLS/RPC
//   thấy đúng auth.uid() như trên Supabase. Không dùng secret key, không bỏ qua RLS.
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { DB } from '@/lib/db';

export const JWT_SECRET = process.env.TEST_JWT_SECRET ?? 'uitc-local-test-secret-at-least-32-characters';
const POSTGREST_URL = process.env.TEST_POSTGREST_URL ?? 'http://127.0.0.1:3010';

export const IDS = {
  A: 'aaaaaaaa-0000-4000-8000-000000000001',
  B: 'aaaaaaaa-0000-4000-8000-000000000002',
  A2: 'aaaaaaaa-0000-4000-8000-000000000003',
  C: 'aaaaaaaa-0000-4000-8000-000000000004',
  C2: 'aaaaaaaa-0000-4000-8000-000000000005',
  L: 'aaaaaaaa-0000-4000-8000-000000000006',
  Q: 'aaaaaaaa-0000-4000-8000-000000000007',
} as const;
export type Who = keyof typeof IDS;

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export function signJwt(payload: Record<string, unknown>) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }));
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

let proxyUrl = '';
let server: http.Server | undefined;

// Proxy /rest/v1/* -> PostgREST /* (supabase-js luôn gọi <url>/rest/v1)
export async function startProxy(): Promise<string> {
  const target = new URL(POSTGREST_URL);
  server = http.createServer((req, res) => {
    const path = (req.url ?? '/').replace(/^\/rest\/v1/, '') || '/';
    const upstream = http.request(
      { hostname: target.hostname, port: target.port, path, method: req.method, headers: { ...req.headers, host: target.host } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => { res.writeHead(502); res.end('upstream error'); });
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  proxyUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  return proxyUrl;
}

export async function stopProxy() {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
}

const anonKey = () => signJwt({ role: 'anon' });

// Client đăng nhập bằng tài khoản thử (giống client của lib/supabase/server.ts mang phiên người dùng)
export function clientAs(who: Who): DB {
  const token = signJwt({ sub: IDS[who], role: 'authenticated', aud: 'authenticated' });
  return createClient<Database>(proxyUrl, anonKey(), {
    accessToken: async () => token,
  }) as unknown as DB;
}

export function anonClient(): DB {
  return createClient<Database>(proxyUrl, anonKey(), { accessToken: async () => anonKey() }) as unknown as DB;
}
