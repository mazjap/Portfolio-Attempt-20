import 'dotenv/config';
import { regenerateProjects, regeneratePosts } from '../lib/regenerate.js';
import { writeSiteFiles } from '../lib/site.js';

const reports = await Promise.all([regenerateProjects(), regeneratePosts()]);
// After the indexes, which the sitemap, feed, and share pages are built from.
await writeSiteFiles();
const skipped = reports.flatMap(r => r.skipped);
if (skipped.length) {
  console.log(`Done, but ${skipped.length} file(s) were skipped (listed above). Run npm run check for details.`);
  process.exitCode = 1;
} else {
  console.log('Done.');
}
