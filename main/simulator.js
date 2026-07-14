'use strict';

const fs = require('fs');
const path = require('path');
require('fix-path')();
const { exec, spawn } = require('child_process');
const { BrowserWindow } = require('electron');

const CHROME_HTML = path.join(__dirname, 'simulatorChrome.html');

// Opens a preview window with a custom HTML toolbar (back/forward/reload/url
// bar) wrapping a <webview> that loads targetUrl, instead of loading
// targetUrl directly into the window.
function openPreviewWindow(targetUrl, width, height) {
  const win = new BrowserWindow({
    width,
    height,
    webPreferences: {
      webviewTag: true
    }
  });
  win.setMenu(null);
  win.loadURL('file://' + CHROME_HTML + '?url=' + encodeURIComponent(targetUrl));
  return win;
}

const simulator = () => {
  const WIDTH = 800;
  const HEIGHT = 600;
  //Deserialize project info from projInfo file, contains path to index.html and presence of webpack among other things
  const projInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/projInfo.js')));

  //Simulation for CRA
  if (projInfo.devServerScript === 'start') {
    let child = exec(
      'npm start',
      {
        cwd: projInfo.rootPath,
      },
      (err, stdout, stderr) => {
        if(err) console.log(err);
        openPreviewWindow('http://localhost:3000', WIDTH, HEIGHT);
      }
    );
  //Simulation for react-dev-server
  } else if (projInfo.devServerScript === 'run dev-server') {
    openPreviewWindow('http://localhost:8085', WIDTH, HEIGHT);
    // let child = exec(
    //   'npm run dev-server',
    //   {
    //     cwd: projInfo.rootPath,
    //     shell: '/bin/bash'
    //   },
    //   (err, stdout, stderr) => {
    //     let child = new BrowserWindow({
    //       width: WIDTH,
    //       height: HEIGHT
    //     });
    //     child.loadURL('http://localhost:8085');
    //     child.openDevTools();
    //   }
    // );
  } else if (projInfo.htmlPath) {
    openPreviewWindow('file://' + projInfo.htmlPath, WIDTH, HEIGHT);
  } else {
    console.log('No Index.html found');
  }
};

module.exports = simulator;
