const entries = [
  { name: 'Harbor Client Co (demo)', purpose: 'Website retainer – November', category: 'Revenue' },
  { name: 'Lagoon Hosting (demo)', purpose: 'Server hosting – November', category: 'Infrastructure' },
  { name: 'Kestrel Design (demo)', purpose: 'Logo revisions', category: 'Design' },
  { name: 'Harbor Client Co (demo)', purpose: 'Website maintenance', category: 'Revenue' },
  { name: 'Lagoon Hosting (demo)', purpose: 'Backup storage', category: 'Infrastructure' },
  { name: 'Harbor Client Co (demo)', purpose: 'December planning deposit', category: 'Revenue' },
] as const;
export function demoEntry(index: number) {
  const entry = entries[index];
  if (!entry) throw new Error('DEMO_ENTRY_REQUIRED');
  return entry;
}
