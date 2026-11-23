export function relayRequestPath(input: string, rewrittenPath?: unknown) {
  const url = new URL(input, 'https://quaestor.invalid');
  if (
    url.pathname.startsWith('/api/qore/') &&
    [...url.searchParams.keys()].every((name) => name === 'qorePath' || name === 'path')
  )
    return url.pathname;
  if (
    !url.searchParams.has('qorePath') &&
    (url.pathname === '/api/qore-relay' || url.pathname.startsWith('/api/qore/')) &&
    rewrittenPath !== undefined
  ) {
    if (typeof rewrittenPath !== 'string') throw new Error('RELAY_PATH_REFUSED');
    url.searchParams.set('qorePath', rewrittenPath);
  }
  if (!url.searchParams.has('qorePath')) return input;
  if (url.pathname !== '/api/qore-relay' && !url.pathname.startsWith('/api/qore/'))
    throw new Error('RELAY_PATH_REFUSED');
  const entries = [...url.searchParams.entries()];
  const path = url.searchParams.get('qorePath');
  const wildcard = url.searchParams.getAll('path');
  if (wildcard.length === 1 && wildcard[0] === path) url.searchParams.delete('path');
  if (
    [...url.searchParams.entries()].length !== 1 ||
    entries.filter(([name]) => name === 'qorePath').length !== 1 ||
    !path ||
    !/^[a-zA-Z0-9_/.]+$/.test(path)
  )
    throw new Error('RELAY_PATH_REFUSED');
  if (path.split('/').some((segment) => segment === '.' || segment === '..')) throw new Error('RELAY_PATH_REFUSED');
  return `/api/qore/${path}`;
}
