import React from 'react';
import { Terminal } from 'xterm';
import * as fit from 'xterm/lib/addons/fit/fit';
const { ipcRenderer } = require('electron');

Terminal.applyAddon(fit);

class XTerm extends React.Component {
  constructor(props) {
    super(props);
    this.term = null;
    this.resizeObserver = null;

    this.handlePtyData = this.handlePtyData.bind(this);
    this.handlePtyExit = this.handlePtyExit.bind(this);
  }

  componentDidMount() {
    // Create a fresh xterm instance
    this.term = new Terminal({
      theme: { background: '#090c0f' },
      rendererType: 'dom',
      cursorStyle: 'block',
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
    });

    const container = document.getElementById('terminal');
    this.term.open(container);
    this.term.fit();

    // Listen for data and exit events from the main process PTY
    ipcRenderer.on('terminal-data', this.handlePtyData);
    ipcRenderer.on('terminal-exit', this.handlePtyExit);

    // Wire every keystroke directly to the PTY via IPC
    this.term.on('data', (data) => {
      ipcRenderer.send('terminal-input', data);
    });

    // Handle terminal resize
    this.term.on('resize', ({ cols, rows }) => {
      ipcRenderer.send('terminal-resize', { cols, rows });
    });

    // Watch the container size and re-fit
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        try {
          this.term.fit();
        } catch (e) {
          // ignore
        }
      });
      this.resizeObserver.observe(container);
    }

    // Spawn the PTY in the project root directory
    this.spawnPty(this.props.rootdir);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.rootdir !== this.props.rootdir && this.props.rootdir) {
      // Project directory changed — restart the shell in the new directory
      this.term.clear();
      this.spawnPty(this.props.rootdir);
    }
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('terminal-data', this.handlePtyData);
    ipcRenderer.removeListener('terminal-exit', this.handlePtyExit);
    ipcRenderer.send('terminal-kill');

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.term) {
      this.term.destroy();
      this.term = null;
    }
  }

  spawnPty(cwd) {
    const cols = this.term ? this.term.cols : 80;
    const rows = this.term ? this.term.rows : 24;
    ipcRenderer.send('terminal-spawn', { cwd: cwd, cols: cols, rows: rows });
  }

  handlePtyData(event, data) {
    if (this.term) {
      this.term.write(data);
    }
  }

  handlePtyExit(event, exitCode) {
    if (this.term) {
      this.term.write('\r\n[Shell exited. Press any key to restart.]\r\n');
    }
    // Allow any key to restart
    const restartHandler = this.term.on('data', () => {
      if (restartHandler && restartHandler.dispose) restartHandler.dispose();
      this.spawnPty(this.props.rootdir);
    });
  }

  render() {
    return <div id='terminal' />;
  }
}

export default XTerm;