import type { APIRoute } from 'astro';

// Uptime monitoring: a live function that answers 200 "ok" and nothing else.
export const prerender = false;

export const GET: APIRoute = () =>
  new Response('ok', { status: 200, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
