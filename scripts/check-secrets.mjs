#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const repoRoot = process.cwd();

const ignoreDirs = new Set(['.git', 'node_modules', 'coverage', '.expo', 'supabase/.temp']);

// Skip scanning files in these path fragments (helps avoid false positives)
const ignorePathFragments = [
  'packages/types/',
  '/migrations/',
  'supabase/migrations/',
  'scripts/check-secrets.mjs',
  'supabase/functions/',
  '.sql'
];

const patterns = [
  /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]{100,}-----END (?:RSA )?PRIVATE KEY-----/i,
  /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]{100,}-----END OPENSSH PRIVATE KEY-----/i,
  /aws_access_key_id\s*[:=]\s*['"`][^'"`]+['"`]/i,
  /aws_secret_access_key\s*[:=]\s*['"`][^'"`]+['"`]/i,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9_]{36}/,
  /api[_-]?key\s*[:=]\s*['"`][A-Za-z0-9_\-]{10,}['"`]/i,
  /token\s*[:=]\s*['"`][^'"`]+['"`]/i,
  /password\s*[:=]\s*['"`][^'"`]+['"`]/i,
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const rel = path.relative(repoRoot, path.join(dir, e.name)).replace(/\\/g, '/');
    if (ignoreDirs.has(e.name) || Array.from(ignoreDirs).some(d => rel.startsWith(d + '/'))) continue;
    if (e.isDirectory()) {
      results.push(...await walk(path.join(dir, e.name)));
    } else if (e.isFile()) {
      const rel = path.relative(repoRoot, path.join(dir, e.name)).replace(/\\/g, '/');
      if (ignorePathFragments.some(f => rel.includes(f))) continue;
      results.push(path.join(dir, e.name));
    }
  }
  return results;
}

function looksLikeText(buf) {
  for (let i = 0; i < Math.min(buf.length, 1024); i++) if (buf[i] === 0) return false;
  return true;
}

async function main() {
  const files = await walk(repoRoot);
  const findings = [];
  for (const f of files) {
    try {
      const stat = await fs.stat(f);
      if (stat.size > 1024 * 1024) continue; // skip big files
      const buf = await fs.readFile(f);
      if (!looksLikeText(buf)) continue;
      const text = buf.toString('utf8');
      for (const re of patterns) {
        if (re.test(text)) {
          findings.push({ file: path.relative(repoRoot, f).replace(/\\/g, '/'), pattern: re.toString() });
          break;
        }
      }
    } catch (err) {
      // ignore unreadable files
    }
  }
  if (findings.length) {
    console.error('Potential secrets found:');
    for (const r of findings) console.error(` - ${r.file}  (${r.pattern})`);
    console.error('\nRemove or rotate secrets before pushing.');
    process.exit(1);
  }
  console.log('No obvious secrets found by quick scan.');
}

main().catch(e=>{console.error(e);process.exit(2)});
