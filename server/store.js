import fs from 'node:fs';
import path from 'node:path';
import { starter, now } from './model.js';

export function createStore(directory, base) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'library.json');
  let data;
  if (fs.existsSync(file)) {
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { throw new Error(`Cannot read ${file}. Your data has been left untouched. Restore a backup before restarting.`); }
    if (data.version !== 1 || !Array.isArray(data.commands) || !Array.isArray(data.demonstrations) || !Array.isArray(data.runs)) throw new Error('Library format is unsupported. Data has been left untouched.');
  } else data = { version: 1, commands: [starter(base)], demonstrations: [], runs: [] };
  const save = () => {
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
  };
  for (const run of data.runs) if (['running','paused','queued'].includes(run.status)) {
    run.status = 'interrupted'; run.finishedAt = now(); run.error = 'The server stopped before this run finished.';
  }
  save();
  return { data, save, directory };
}
