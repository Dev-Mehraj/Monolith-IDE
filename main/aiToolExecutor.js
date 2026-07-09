'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const IGNORED_DIR_NAMES = new Set(['node_modules', '.git', '.next', 'dist', 'build']);
const MAX_FIND_RESULTS = 200;
const RUN_COMMAND_TIMEOUT_MS = 30000;
const RUN_COMMAND_MAX_BUFFER = 5 * 1024 * 1024;

// Resolves a user/model-supplied path against the project root and rejects
// anything that escapes it, so a tool call can't read/write outside the
// currently open project.
function resolveSafePath(projectRoot, inputPath) {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, inputPath || '.');
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path "' + inputPath + '" is outside the project root and is not allowed.');
  }
  return resolved;
}

// fs.mkdirSync's `recursive` option needs Node 10.12+; this app's bundled
// Electron ships an older Node that silently ignores it and throws EEXIST
// for a directory that already exists (which is nearly always the case for
// write_file). Walk up and create each missing segment by hand instead.
function ensureDirRecursive(dir) {
  if (fs.existsSync(dir)) return;
  ensureDirRecursive(path.dirname(dir));
  try {
    fs.mkdirSync(dir);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(escaped, 'i');
}

function findFiles(projectRoot, { pattern, dir }) {
  const startDir = resolveSafePath(projectRoot, dir || '.');
  const matcher = globToRegExp(pattern);
  const results = [];

  function walk(currentDir) {
    if (results.length >= MAX_FIND_RESULTS) return;
    let names;
    try {
      names = fs.readdirSync(currentDir);
    } catch (e) {
      return;
    }
    for (const name of names) {
      if (results.length >= MAX_FIND_RESULTS) return;
      const fullPath = path.join(currentDir, name);
      let stats;
      try {
        stats = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      if (stats.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(name)) continue;
        walk(fullPath);
      } else if (matcher.test(name)) {
        results.push(path.relative(projectRoot, fullPath));
      }
    }
  }

  walk(startDir);
  return {
    ok: true,
    result: {
      matches: results,
      truncated: results.length >= MAX_FIND_RESULTS,
    },
  };
}

function readFile(projectRoot, { path: filePath }) {
  const resolved = resolveSafePath(projectRoot, filePath);
  const content = fs.readFileSync(resolved, { encoding: 'utf8' });
  const numbered = content.split('\n').map((line, i) => (i + 1) + '\t' + line).join('\n');
  return { ok: true, result: { path: filePath, content: numbered } };
}

function writeFile(projectRoot, { path: filePath, content }) {
  const resolved = resolveSafePath(projectRoot, filePath);
  ensureDirRecursive(path.dirname(resolved));
  fs.writeFileSync(resolved, content, { encoding: 'utf8' });
  return { ok: true, result: { path: filePath, bytesWritten: Buffer.byteLength(content, 'utf8') }, changedFile: { path: resolved, content } };
}

function editFile(projectRoot, { path: filePath, old_string, new_string }) {
  const resolved = resolveSafePath(projectRoot, filePath);
  const original = fs.readFileSync(resolved, { encoding: 'utf8' });
  const occurrences = original.split(old_string).length - 1;

  if (occurrences === 0) {
    return { ok: false, error: 'old_string was not found in ' + filePath + '. Re-read the file and copy the exact text, or use write_file to create/overwrite it.' };
  }
  if (occurrences > 1) {
    return { ok: false, error: 'old_string matches ' + occurrences + ' locations in ' + filePath + '. Include more surrounding context so it matches exactly once.' };
  }

  const updated = original.replace(old_string, new_string);
  fs.writeFileSync(resolved, updated, { encoding: 'utf8' });
  return { ok: true, result: { path: filePath }, changedFile: { path: resolved, content: updated } };
}

function runCommand(projectRoot, { command, cwd }) {
  const resolvedCwd = resolveSafePath(projectRoot, cwd || '.');
  return new Promise((resolve) => {
    exec(command, { cwd: resolvedCwd, timeout: RUN_COMMAND_TIMEOUT_MS, maxBuffer: RUN_COMMAND_MAX_BUFFER }, (err, stdout, stderr) => {
      const exitCode = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      resolve({
        ok: exitCode === 0,
        result: {
          command,
          stdout: stdout ? stdout.toString() : '',
          stderr: stderr ? stderr.toString() : '',
          exitCode,
        },
      });
    });
  });
}

async function executeTool(name, args, projectRoot) {
  try {
    switch (name) {
      case 'find_files':
        return findFiles(projectRoot, args);
      case 'read_file':
        return readFile(projectRoot, args);
      case 'write_file':
        return writeFile(projectRoot, args);
      case 'edit_file':
        return editFile(projectRoot, args);
      case 'run_command':
        return await runCommand(projectRoot, args);
      default:
        return { ok: false, error: 'Unknown tool: ' + name };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { executeTool, resolveSafePath };
