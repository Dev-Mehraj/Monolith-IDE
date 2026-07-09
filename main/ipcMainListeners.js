'use strict';

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const deleteItem = require('../lib/delete-directory');
const simulator = require('./simulator');
const windowSimulator = require('./windowSimulator')
const closeSim = require('./closeSim');

module.exports = () => {
  //ipcMain listeners

  ipcMain.on('ollama-chat', (event, { model, messages, systemPrompt, temperature }) => {
    let aborted = false;

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const payload = JSON.stringify({
      model,
      messages: allMessages,
      stream: true,
      options: { temperature: temperature != null ? temperature : 0.7 },
    });

    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', chunk => {
        if (aborted) return;
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop(); // hold incomplete line
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.error) {
              if (!aborted) event.sender.send('ollama-chat-error', obj.error);
              continue;
            }
            if (obj.message && obj.message.content) {
              event.sender.send('ollama-chat-chunk', obj.message.content);
            }
            if (obj.done) {
              event.sender.send('ollama-chat-done', {
                totalTokens: obj.eval_count,
                promptTokens: obj.prompt_eval_count,
              });
            }
          } catch (_) { /* skip malformed lines */ }
        }
      });
      res.on('end', () => {
        if (!aborted) event.sender.send('ollama-chat-done', {});
      });
    });

    req.on('error', (e) => {
      if (!aborted) event.sender.send('ollama-chat-error', e.message);
    });

    // One-shot stop handler
    const stopHandler = () => {
      aborted = true;
      req.destroy();
      event.sender.send('ollama-chat-done', { aborted: true });
    };
    ipcMain.once('ollama-stop', stopHandler);

    req.on('close', () => {
      ipcMain.removeListener('ollama-stop', stopHandler);
    });

    req.write(payload);
    req.end();
  });
  ipcMain.on('ollama-list-models', (event) => {
    http.get('http://localhost:11434/api/tags', (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const models = (data.models || []).map(m => ({
            name: m.name,
            provider: 'ollama',
            source: 'local'
          }));
          event.sender.send('ollama-models-list', models);
        } catch (e) {
          event.sender.send('ollama-models-list', []);
        }
      });
    }).on('error', () => {
      event.sender.send('ollama-models-list', []);
    });
  });

  ipcMain.on('openSimulator', (event) => {
    simulator();
  });

  ipcMain.on('openInWindow', () => {
    // console.log('firing inWindowSimulator')
    InWindowSimulator();
  })
  
  ipcMain.on('createItem', (event, dirPath, name, type) => {
    if (type === 'file') {
      fs.writeFile(path.join(dirPath, name), '', err => {
        if (err) console.log(err);
      });
    } else {
      fs.mkdir(path.join(dirPath, name), err => {
        if (err) console.log(err);
      });
    }
  });

  ipcMain.on('delete', (event, itemPath) => {
    deleteItem(itemPath);
  });

  ipcMain.on('rename', (event, itemPath, newName) => {
    fs.rename(itemPath, path.join(path.dirname(itemPath), newName), (err) => {
      if(err) console.log(err);
    });
  });
  ipcMain.on('start simulator', ()=> {
    windowSimulator();
  });
  ipcMain.on('closeSim', (event, pid) => {
    closeSim(pid);
  });
};
