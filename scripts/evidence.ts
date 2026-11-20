if (process.argv[2] === '--m1') await import('./m1-roundtrip.js');
else if (process.argv[2] === '--m1-logs') await import('./m1-logrange.js');
else throw new Error('Specify --m1 or --m1-logs; later milestone evidence is not built.');
