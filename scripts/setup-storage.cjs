require('@next/env').loadEnvConfig(process.cwd());
require('../lib/storage').setupBucket().then(({ created }) => {
  console.log(created ? 'Public school image bucket created (4 MiB, images only).' : 'Existing school image bucket verified.');
}).catch((error) => { console.error(error.message); process.exitCode = 1; });
