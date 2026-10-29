// `npm run smoke -- https://jordan-christensen.com`: read-only checks against a deployed site (GETs
// only, no token). Run after every deploy. Exits with 1 if anything fails.
const base = (process.argv[2] ?? 'http://localhost:3001').replace(/\/+$/, '');
let failures = 0;

function report(status: 'PASS' | 'WARN' | 'FAIL', name: string, detail = ''): void {
  if (status === 'FAIL') failures++;
  console.log(`${status}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function get(path: string, redirect: RequestRedirect = 'follow'): Promise<Response | null> {
  try {
    return await fetch(base + path, { redirect, headers: { 'user-agent': 'portfolio-smoke-test' } });
  } catch (err) {
    report('FAIL', `GET ${path}`, (err as Error).message);
    return null;
  }
}

async function json<T>(path: string): Promise<T | null> {
  const res = await get(path);
  if (!res) return null;
  if (!res.ok) {
    report('FAIL', `GET ${path}`, `HTTP ${res.status}`);
    return null;
  }
  return (await res.json()) as T;
}

const health = await json<{ status: string }>('/api/health');
report(health?.status === 'ok' ? 'PASS' : 'FAIL', 'API health', JSON.stringify(health));

const projects = await json<{ id: string; heroImage?: string }[]>('/api/projects');
report(Array.isArray(projects) && projects.length > 0 ? 'PASS' : 'FAIL', 'project list', `${projects?.length ?? 0} projects`);
const posts = await json<{ id: string }[]>('/api/posts');
report(Array.isArray(posts) ? 'PASS' : 'FAIL', 'post list', `${posts?.length ?? 0} posts`);

const project = projects?.[0];
if (project) {
  const detail = await json<{ id: string }>(`/api/projects/${project.id}`);
  report(detail?.id === project.id ? 'PASS' : 'FAIL', `project detail /api/projects/${project.id}`);

  const page = await get(`/projects/${project.id}`);
  const html = page?.ok ? await page.text() : '';
  report(html.includes('<div id="root">') ? 'PASS' : 'FAIL', `deep link /projects/${project.id} serves the app`);
  report(html.includes('og:title') ? 'PASS' : 'WARN', 'share page with Open Graph tags', html.includes('og:title') ? '' : 'missing: check the _meta rule in .htaccess, then run regen');

  if (project.heroImage?.startsWith('/media/')) {
    const image = await get(encodeURI(project.heroImage));
    report(image?.ok ? 'PASS' : 'FAIL', `hero image ${project.heroImage}`, image ? `HTTP ${image.status}` : '');
    if (project.heroImage.endsWith('.webp')) {
      const small = await get(encodeURI(project.heroImage.replace(/\.webp$/, '.w640.webp')));
      report(small?.ok ? 'PASS' : 'WARN', 'smaller image size exists', small?.ok ? '' : 'run node scripts/derive-media.js on the server');
    }
  }
}
if (posts?.[0]) {
  const post = await json<{ id: string }>(`/api/posts/${posts[0].id}`);
  report(post?.id === posts[0].id ? 'PASS' : 'FAIL', `post detail /api/posts/${posts[0].id}`);
}

for (const [path, marker] of [['/sitemap.xml', '<urlset'], ['/feed.xml', '<rss']] as const) {
  const res = await get(path);
  const text = res?.ok ? await res.text() : '';
  report(text.includes(marker) ? 'PASS' : 'FAIL', path, res ? `HTTP ${res.status}` : '');
}

const missing = await get('/api/definitely-not-a-route');
const missingType = missing?.headers.get('content-type') ?? '';
report(missing?.status === 404 && missingType.includes('json') ? 'PASS' : 'FAIL', 'unknown API route is a JSON 404', `${missing?.status} ${missingType}`);

const legacy = await get('/trekpoint-privacy', 'manual');
const location = legacy?.headers.get('location') ?? '';
report(legacy && legacy.status >= 300 && legacy.status < 400 && location.includes('/apps/trekpoint/privacy-policy') ? 'PASS' : 'WARN', 'legacy app link redirects', `${legacy?.status} → ${location || 'none'}`);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll required checks passed.');
process.exitCode = failures ? 1 : 0;
