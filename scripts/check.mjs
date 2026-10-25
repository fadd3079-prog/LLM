import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : `${dir}/${entry.name}`))).flat();
}
const files = (await walk('js')).filter(file => file.endsWith('.js'));
for (const file of files) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (check.status) throw new Error(check.stderr);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) await access(resolve(dirname(file), match[1]));
}
const html = await readFile('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
if (ids.length !== new Set(ids).size) throw new Error('Duplicate HTML ids');
for (const m of html.matchAll(/(?:src|href)="((?:js|css|vendor|assets)\/[^"#]+)"/g)) await access(m[1]);
console.log(`${files.length} JavaScript modules parse; imports, HTML IDs, and local assets pass.`);
