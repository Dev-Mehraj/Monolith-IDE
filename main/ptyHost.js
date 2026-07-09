#!/usr/bin/env node
'use strict';

// This script runs under the SYSTEM Node.js (not Electron's bundled Node),
// so that the native node-pty module (compiled against the system Node ABI)
// loads correctly.
//
// Communication with the Electron main process happens over JSON-newline messages
// on stdin/stdout.

const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');

// --- Locate Git Bash ---
function findBashPath() {
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    path.join(os.homedir(), 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'bash.exe';
}

let ptyProcess = null;

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function spawnShell(cwd, cols, rows) {
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }

  const shell = findBashPath();

  ptyProcess = pty.spawn(shell, ['--login'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || os.homedir(),
    env: Object.assign({}, process.env, { TERM: 'xterm-256color' }),
  });

  ptyProcess.onData((data) => {
    send({ type: 'data', data: data });
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    send({ type: 'exit', exitCode: exitCode, signal: signal });
    ptyProcess = null;
  });

  send({ type: 'spawned' });
}

// --- Read JSON-newline messages from Electron main on stdin ---
let inputBuffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  inputBuffer += chunk;
  let newlineIdx;
  while ((newlineIdx = inputBuffer.indexOf('\n')) !== -1) {
    const line = inputBuffer.slice(0, newlineIdx).trim();
    inputBuffer = inputBuffer.slice(newlineIdx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      handleMessage(msg);
    } catch (e) {
      // skip malformed lines
    }
  }
});

function handleMessage(msg) {
  switch (msg.type) {
    case 'spawn':
      spawnShell(msg.cwd, msg.cols, msg.rows);
      break;
    case 'input':
      if (ptyProcess) ptyProcess.write(msg.data);
      break;
    case 'resize':
      if (ptyProcess) {
        try {
          ptyProcess.resize(msg.cols, msg.rows);
        } catch (e) {
          // ignore
        }
      }
      break;
    case 'kill':
      if (ptyProcess) {
        ptyProcess.kill();
        ptyProcess = null;
      }
      break;
  }
}

process.stdin.on('end', () => {
  if (ptyProcess) ptyProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (ptyProcess) ptyProcess.kill();
  process.exit(0);
});
