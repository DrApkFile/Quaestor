import type { IncomingMessage, ServerResponse } from 'node:http';
import { relayPlan } from '../../apps/web/server/qorePolicy.js';
async function requestBody(request: IncomingMessage): Promise<unknown> {
  const parsed = request as IncomingMessage & { body?: unknown };
  if (parsed.body !== undefined) {
    const text = typeof parsed.body === 'string' ? parsed.body : JSON.stringify(parsed.body);
    if (Buffer.byteLength(text) > 400000) throw new Error('BODY_TOO_LARGE');
    return JSON.parse(text) as unknown;
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const value of request as AsyncIterable<unknown>) {
    const chunk = typeof value === 'string' ? Buffer.from(value) : value instanceof Uint8Array ? value : null;
    if (!chunk) throw new Error('INVALID_BODY');
    length += chunk.length;
    if (length > 400000) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const method = request.method ?? '';
    const body = method === 'POST' ? await requestBody(request) : undefined;
    const plan = relayPlan(request.url ?? '', method, body);
    const headers: Record<string, string> = {};
    const height = request.headers['x-cosmos-block-height'];
    if (height !== undefined) {
      if (typeof height !== 'string' || !/^\d+$/.test(height)) throw new Error('HEIGHT_REFUSED');
      headers['x-cosmos-block-height'] = height;
    }
    if (plan.method === 'POST') headers['content-type'] = 'application/json';
    const upstream = await fetch(plan.url, {
      method: plan.method,
      headers,
      ...(plan.body ? { body: plan.body } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    response.statusCode = upstream.status;
    response.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json');
    response.setHeader('cache-control', 'no-store');
    const at = upstream.headers.get('x-cosmos-block-height');
    if (at) response.setHeader('x-cosmos-block-height', at);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.statusCode = 400;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ error: 'QORE_RELAY_REFUSED' }));
  }
}
