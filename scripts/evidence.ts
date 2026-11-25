if (process.argv[2] === '--m10b-deploy') await import('./m10b-deploy.js');
else if (
  process.argv[2]?.startsWith('--m10b-') &&
  process.argv[2] !== '--m10b-secret-scan' &&
  process.argv[2] !== '--m10b-checks'
)
  await import('./m10b-browser.js');
else if (['--m10-secret-scan', '--m10b-secret-scan'].includes(process.argv[2] ?? ''))
  await import('./m10-secret-scan.js');
else if (process.argv[2] === '--m10b-checks') await import('./m10-checks.js');
else if (process.argv[2] === '--m10-checks') await import('./m10-checks.js');
else if (process.argv[2] === '--m10-audit') await import('./m10-audit.js');
else if (['--m10-screens', '--m10-fresh-signup', '--m10-cashout-retry'].includes(process.argv[2] ?? ''))
  await import('./m10-browser.js');
else if (process.argv[2] === '--m9-deploy') await import('./m9-deploy.js');
else if (process.argv[2] === '--m9-bundles') await import('./m9-bundles.js');
else if (process.argv[2] === '--m9-judge') await import('./m9-browser.js');
else if (process.argv[2] === '--m9-fresh-signup') await import('./m9-browser.js');
else if (process.argv[2] === '--m9-manual-retry') await import('./m9-browser.js');
else if (process.argv[2] === '--m9-cost') await import('./m9-cost.js');
else if (process.argv[2] === '--m9-wallet-readback') await import('./m9-browser.js');
else if (process.argv[2] === '--m9-secret-scan') await import('./m9-secret-scan.js');
else if (process.argv[2] === '--m9-checks') await import('./m9-checks.js');
else if (process.argv[2] === '--m9-unit') await import('./m9-unit.js');
else if (process.argv[2] === '--m1') await import('./m1-roundtrip.js');
else if (process.argv[2] === '--m1-logs') await import('./m1-logrange.js');
else if (process.argv[2] === '--m1-gas') await import('./m1-gas.js');
else if (process.argv[2] === '--m1b-fusd') await import('./m1b-fusd.js');
else if (process.argv[2] === '--m1-gas-policy') await import('./m1-gas-policy.js');
else if (process.argv[2] === '--m2') await import('./m2b-ticket.js');
else if (process.argv[2] === '--m3-spikes') await import('./m3-spikes.js');
else if (process.argv[2] === '--m3') await import('./m3-books.js');
else if (process.argv[2] === '--m4-deploy') await import('./m4-deploy.js');
else if (process.argv[2] === '--m4-deploy-recover') await import('./m4-recover.js');
else if (process.argv[2] === '--m4-proof-spike') await import('./m4-proof-spike.js');
else if (process.argv[2] === '--m4') await import('./m4-verdicts.js');
else if (process.argv[2] === '--m4-deployment-diagnostics') await import('./m4-diagnostics.js');
else if (process.argv[2] === '--m5-browser-spike') await import('./m5-browser-spike.js');
else if (process.argv[2] === '--m5-deploy') await import('./m5-deploy.js');
else if (process.argv[2] === '--m5-native-spike') await import('./m5-native-spike.js');
else if (process.argv[2] === '--m5-publish') await import('./m5-publish.js');
else if (process.argv[2] === '--m5-blobs') await import('./m5-blobs.js');
else if (process.argv[2] === '--m5-web') await import('./m5-web.js');
else if (process.argv[2] === '--m8-funding-diagnostics') await import('./m8-funding-diagnostics.js');
else if (process.argv[2] === '--m8-repo') await import('./m8-repo.js');
else if (process.argv[2] === '--m8-secret-scan') await import('./m8-secret-scan.js');
else if (process.argv[2] === '--m8-presubmit') await import('./m8-presubmit.js');
else if (process.argv[2] === '--m8-kits') await import('./m8-kits.js');
else if (process.argv[2] === '--m8-cover') await import('./m8-cover.js');
else if (['--m7b', '--m8-privacy'].includes(process.argv[2] ?? '')) await import('./m8-demo.js');
else if (process.argv[2] === '--m7') throw new Error('M7_RUN_SUPERSEDED_USE_M7B_OR_M8_PRIVACY');
else if (process.argv[2] === '--m6') await import('./m6-browser.js');
else if (process.argv[2] === '--m6-funding') await import('./m6-funding.js');
else throw new Error('Specify an implemented milestone evidence command.');
