import fs from 'node:fs';
// Vercel serves a physical index before custom rewrites. Keep the old studio
// shell under its own filename and make the focused task UI the actual index.
fs.copyFileSync('dist-cloud/index.html','dist-cloud/studio.html');
fs.copyFileSync('dist-cloud/extension.html','dist-cloud/index.html');
