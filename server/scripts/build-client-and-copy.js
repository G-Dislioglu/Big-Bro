const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const serverDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverDir, '..');
const clientDir = path.resolve(repoRoot, 'client');
const clientDistDir = path.resolve(clientDir, 'dist');
const serverPublicDir = path.resolve(serverDir, 'public');

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureEmptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.error(`ERROR: Source directory does not exist: ${srcDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    fs.cpSync(src, dest, { recursive: true });
  }
}

run('npm', ['install'], clientDir);
run('npm', ['run', 'build'], clientDir);

ensureEmptyDir(serverPublicDir);

if (!fs.existsSync(path.join(clientDistDir, 'index.html'))) {
  console.error(`ERROR: Build did not produce index.html in ${clientDistDir}`);
  process.exit(1);
}

copyDirContents(clientDistDir, serverPublicDir);
