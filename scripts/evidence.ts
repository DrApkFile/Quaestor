if (process.argv[2] === '--m1')
    await import('./m1-roundtrip.js');
else if (process.argv[2] === '--m1-logs')
    await import('./m1-logrange.js');
else if (process.argv[2] === '--m1-gas')
    await import('./m1-gas.js');
else if (process.argv[2] === '--m1b-fusd')
    await import('./m1b-fusd.js');
else if (process.argv[2] === '--m1-gas-policy')
    await import('./m1-gas-policy.js');
else if (process.argv[2] === '--m2')
    await import('./m2b-ticket.js');
else
    throw new Error('Specify an implemented M1 or M2 evidence command.');
