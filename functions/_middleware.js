// Cloudflare Pages Functions Global Middleware
// Adds CORS, Anti-Caching headers, and global exception handling

export async function onRequest(context) {
  const { request, next } = context;

  // Handle CORS Preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const response = await next();
    const newHeaders = new Headers(response.headers);

    // Ensure CORS headers on all responses
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');

    // Never cache API responses in client browsers or intermediate proxies
    if (new URL(request.url).pathname.startsWith('/api/')) {
      newHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      newHeaders.set('Surrogate-Control', 'no-store');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    console.error('[Cloudflare Middleware] Uncaught error:', err);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: err?.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  }
}
