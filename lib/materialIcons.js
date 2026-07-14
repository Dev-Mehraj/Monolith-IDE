'use strict';

var path = require('path');

var ICONS_DIR = path.join(__dirname, '..', 'node_modules', 'material-icon-theme', 'icons');

var EXT_MAP = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'react',
  ts: 'typescript',
  tsx: 'react_ts',
  css: 'css',
  less: 'less',
  sass: 'sass',
  scss: 'sass',
  html: 'html',
  htm: 'html',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  xml: 'xml',
  svg: 'svg',
  yml: 'yaml',
  yaml: 'yaml',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  go: 'go',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sql: 'database',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  bat: 'bat',
  cmd: 'bat',
  dockerfile: 'docker',
  vue: 'vue',
  swift: 'swift',
  r: 'r',
  lua: 'lua',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  clj: 'clojure',
  scala: 'scala',
  graphql: 'graphql',
  gql: 'graphql',
  toml: 'toml',
  ini: 'settings',
  cfg: 'settings',
  env: 'tune',
  lock: 'lock',
  log: 'log',
  txt: 'document',
  pdf: 'pdf',
  zip: 'zip',
  gz: 'zip',
  tar: 'zip',
  rar: 'zip',
  '7z': 'zip',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  ico: 'image',
  webp: 'image',
  bmp: 'image',
  eot: 'font',
  woff: 'font',
  woff2: 'font',
  ttf: 'font',
  otf: 'font',
  gitignore: 'git',
};

var FILENAME_MAP = {
  'package.json': 'nodejs',
  'package-lock.json': 'nodejs',
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.babelrc': 'babel',
  'babel.config.js': 'babel',
  'webpack.config.js': 'webpack',
  'tsconfig.json': 'tsconfig',
  'dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  '.eslintrc': 'eslint',
  '.eslintrc.js': 'eslint',
  '.eslintrc.json': 'eslint',
  '.prettierrc': 'prettier',
  'prettier.config.js': 'prettier',
  'readme.md': 'readme',
  'license': 'certificate',
  'license.md': 'certificate',
  'makefile': 'makefile',
  '.env': 'tune',
  '.env.local': 'tune',
  '.env.development': 'tune',
  '.env.production': 'tune',
  'yarn.lock': 'yarn',
  '.npmrc': 'npm',
  'rollup.config.js': 'rollup',
  'vite.config.js': 'vite',
  'vite.config.ts': 'vite',
  'jest.config.js': 'jest',
  'jest.config.ts': 'jest',
};

var FOLDER_MAP = {
  src: 'folder-src',
  lib: 'folder-lib',
  dist: 'folder-dist',
  build: 'folder-dist',
  test: 'folder-test',
  tests: 'folder-test',
  __tests__: 'folder-test',
  node_modules: 'folder-node',
  public: 'folder-public',
  assets: 'folder-images',
  images: 'folder-images',
  img: 'folder-images',
  components: 'folder-components',
  config: 'folder-config',
  utils: 'folder-utils',
  helpers: 'folder-helper',
  hooks: 'folder-hook',
  styles: 'folder-css',
  css: 'folder-css',
  api: 'folder-api',
  docs: 'folder-docs',
  scripts: 'folder-scripts',
  '.git': 'folder-git',
  '.github': 'folder-github',
  '.vscode': 'folder-vscode',
  vendor: 'folder-packages',
  packages: 'folder-packages',
  app: 'folder-app',
  pages: 'folder-views',
  views: 'folder-views',
  layouts: 'folder-layout',
  middleware: 'folder-middleware',
  routes: 'folder-routes',
  types: 'folder-typescript',
  main: 'folder-main',
  renderer: 'folder-app',
  menus: 'folder-context',
};

// <img src> needs a file:// URI with forward slashes, not a raw filesystem
// path — a bare "E:\...\icon.svg" string is not a valid URL and silently
// fails to load in Chromium.
function toFileUrl(absPath) {
  return 'file://' + absPath.replace(/\\/g, '/');
}

function getFileIconPath(filename) {
  var lower = filename.toLowerCase();
  var mapped = FILENAME_MAP[lower];
  if (mapped) {
    return toFileUrl(path.join(ICONS_DIR, mapped + '.svg'));
  }
  var dotIdx = lower.lastIndexOf('.');
  if (dotIdx > -1) {
    var ext = lower.slice(dotIdx + 1);
    mapped = EXT_MAP[ext];
    if (mapped) {
      return toFileUrl(path.join(ICONS_DIR, mapped + '.svg'));
    }
  }
  return toFileUrl(path.join(ICONS_DIR, 'file.svg'));
}

function getFolderIconPath(folderName, opened) {
  var lower = folderName.toLowerCase();
  var mapped = FOLDER_MAP[lower];
  if (mapped) {
    var base = opened ? mapped + '-open' : mapped;
    return toFileUrl(path.join(ICONS_DIR, base + '.svg'));
  }
  return toFileUrl(path.join(ICONS_DIR, opened ? 'folder-open.svg' : 'folder.svg'));
}

module.exports = { getFileIconPath, getFolderIconPath };
