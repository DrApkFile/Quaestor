if (process.argv[2] !== '--m1') throw new Error('Specify --m1; later milestone evidence is not built.');
await import('./m1-roundtrip.js');
