import 'dotenv/config';
import { regenerateProjects, regeneratePosts } from '../lib/regenerate.js';

await Promise.all([regenerateProjects(), regeneratePosts()]);
console.log('Done.');
