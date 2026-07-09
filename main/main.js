'use strict';

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const menuTemplate = require('./menus/mainMenu');
const registerShortcuts = require('./localShortcuts');
const registerIpcListeners = require('./ipcMainListeners');
const { exec } = require('child_process');

const projInfoPath = path.join(__dirname, '../lib/projInfo.js');
const projInfo = {
  htmlPath: '',
  hotLoad: false,
  webpack: false,
  rootPath: '',
  devServer: false,
  devServerScript: '',
  mainEntry: '',
  reactEntry: ''
};
 // Main window init
 // define window in global scope to prevent garbage collection
 let win = null;
 app.on('ready', () => {
   // initialize main window
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 604,
    minHeight: 283,
    title: 'Monolith',
    // titleBarStyle: hidden-inset, // pending
    // icon: image,
    show: false
  });

  // load index.html to main window
  win.loadURL('file://' + path.join(__dirname, '../renderer/index.html'));

  // Wait for window to be ready before showing to avoid white loading screen
  win.once('ready-to-show', () => {
    win.show();
  });

  // initialize menus
  const menu = Menu.buildFromTemplate(menuTemplate(win));
  Menu.setApplicationMenu(menu);

  // put Main window instance in global variable for use in other modules
  global.mainWindow = win;

  // Register listeners and shortcuts
  registerIpcListeners();
  registerShortcuts(win);
  //Register listener to close entire window + simulator window when mainWindow closes
  win.on('closed', function(){
    fs.writeFileSync(projInfoPath, JSON.stringify(projInfo));
    exec(
      'killall node',
      (err, stdout, stderr) => {
      }
    );
    app.quit();
  });
});
