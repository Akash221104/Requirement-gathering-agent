import path from 'path';
import os from 'os';
import fs from 'fs';

let initialized = false;

/**
 * Returns the active root data directory.
 * When running in Vercel or serverless environments (where process.cwd() is read-only),
 * this resolves to os.tmpdir()/specpilot-data. On lambda cold-start, it copies existing seeded
 * projects/meetings from process.cwd()/data into /tmp so files are immediately available and writable.
 * In local development, it uses path.join(process.cwd(), 'data').
 */
export function getDataRootDir(): string {
  if (process.env.VERCEL) {
    const tmpDataDir = path.join(os.tmpdir(), 'specpilot-data');
    if (!initialized) {
      try {
        if (!fs.existsSync(tmpDataDir)) {
          fs.mkdirSync(tmpDataDir, { recursive: true });
        }
        const seedDataDir = path.join(process.cwd(), 'data');
        if (fs.existsSync(seedDataDir)) {
          fs.cpSync(seedDataDir, tmpDataDir, { recursive: true });
        }
      } catch (err) {
        console.warn('[Storage] Notice copying seed data to /tmp:', err);
      }
      initialized = true;
    }
    return tmpDataDir;
  }
  return path.join(process.cwd(), 'data');
}

export function getProjectsDir(): string {
  return path.join(getDataRootDir(), 'projects');
}

export function getCalendarDir(): string {
  return path.join(getDataRootDir(), 'calendar');
}
