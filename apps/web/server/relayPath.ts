export function relayRequestPath(input: string) {
  const url = new URL(input, 'https://quaestor.invalid');
  if (!url.searchParams.has('qorePath')) return input;
  if (url.pathname !== '/api/qore-relay' && !url.pathname.startsWith('/api/qore/'))
    throw new Error('RELAY_PATH_REFUSED');
  const entries = [...url.searchParams.entries()];
  const path = url.searchParams.get('qorePath');
  if (entries.length !== 1 || !path || !/^[a-zA-Z0-9_/.]+$/.test(path)) throw new Error('RELAY_PATH_REFUSED');
  if (path.split('/').some((segment) => segment === '.' || segment === '..')) throw new Error('RELAY_PATH_REFUSED');
  return `/api/qore/${path}`;
}
