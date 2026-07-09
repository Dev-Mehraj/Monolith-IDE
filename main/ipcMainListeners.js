'use strict';

const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const deleteItem = require('../lib/delete-directory');
const simulator = require('./simulator');
const windowSimulator = require('./windowSimulator')
const closeSim = require('./closeSim');
const { executeTool } = require('./aiToolExecutor');
const { toOllamaToolSchemas, buildEmulationPromptBlock, getToolByName } = require('../lib/aiTools/toolDefinitions');

const MAX_TOOL_ITERATIONS = 10;
const TOOL_CALL_TAG_RE = /<tool_call>([\s\S]*?)<\/tool_call>/;

// Runs one streaming /api/chat request. Calls onChunk(text) live when liveStream
// is true (native tool-calling models); otherwise buffers content and only
// returns it at the end (used for prompt-emulation models, so a raw
// <tool_call> tag never leaks into the visible chat).
function streamChat({ model, messages, tools, temperature, liveStream, onChunk, onThinking, abortState }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model,
      messages,
      tools: tools && tools.length ? tools : undefined,
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

    let content = '';
    let thinking = '';
    const toolCalls = [];
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      abortState.destroy = null;
      resolve(result);
    };

    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', chunk => {
        if (abortState.aborted) return;
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.error) {
              if (!settled) { settled = true; abortState.destroy = null; reject(new Error(obj.error)); }
              return;
            }
            if (obj.message && obj.message.content) {
              content += obj.message.content;
              if (liveStream) onChunk(obj.message.content);
            }
            if (obj.message && obj.message.thinking) {
              thinking += obj.message.thinking;
              if (onThinking) onThinking(obj.message.thinking);
            }
            if (obj.message && Array.isArray(obj.message.tool_calls)) {
              toolCalls.push(...obj.message.tool_calls);
            }
          } catch (_) { /* skip malformed lines */ }
        }
      });
      res.on('end', () => finish({ content, thinking, toolCalls }));
    });

    req.on('error', (e) => {
      if (abortState.aborted) { finish({ content, thinking, toolCalls }); return; }
      if (!settled) { settled = true; abortState.destroy = null; reject(e); }
    });

    abortState.destroy = () => { req.destroy(); finish({ content, thinking, toolCalls }); };

    req.write(payload);
    req.end();
  });
}

// Gemini streaming chat – same interface as streamChat above.
function streamGeminiChat({ model, messages, tools, temperature, liveStream, onChunk, onThinking, abortState, apiKey }) {
  return new Promise((resolve, reject) => {
    let content = '';
    let thinking = '';
    const toolCalls = [];
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      abortState.destroy = null;
      resolve(result);
    };

    const contents = messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') {
        let parsedResponse = {};
        try { parsedResponse = JSON.parse(m.content || '{}'); } catch (_) {}
        return { role: 'function', parts: [{ functionResponse: { name: m.tool_name || '', response: parsedResponse } }] };
      }
      return { role: m.role === 'assistant' ? 'model' : m.role, parts: [{ text: m.content || '' }] };
    });

    const systemMsg = messages.find(m => m.role === 'system');

    const body = {
      contents,
      generationConfig: { temperature: temperature != null ? temperature : 0.7 },
    };

    if (tools && tools.length) {
      body.tools = [{
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      }];
    }

    if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

    const payload = JSON.stringify(body);
    const url = 'https://generativelanguage.googleapis.com/v1/models/' + model + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(apiKey);

    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let buf = '';
      if (res.statusCode !== 200) {
        res.on('data', chunk => buf += chunk);
        res.on('end', () => {
          let msg = 'Gemini API error (HTTP ' + res.statusCode + ')';
          try { const e = JSON.parse(buf); if (e.error) msg = e.error.message || msg; } catch (_) {}
          finish({ error: msg });
        });
        return;
      }
      res.on('data', chunk => {
        if (abortState.aborted) return;
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const obj = JSON.parse(jsonStr);
            if (obj.error) { finish({ error: obj.error.message || 'Gemini API error' }); return; }
            const candidate = obj.candidates && obj.candidates[0];
            if (!candidate) continue;
            if (candidate.content && candidate.content.parts) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  content += part.text;
                  if (liveStream) onChunk(part.text);
                }
                if (part.functionCall) {
                  toolCalls.push({
                    function: {
                      name: part.functionCall.name,
                      arguments: JSON.stringify(part.functionCall.args || {}),
                    },
                  });
                }
              }
            }
            if (candidate.finishReason && candidate.finishReason !== 'MAX_TOKENS') {
              if (!settled && candidate.finishReason !== 'STOP') {
                finish({ content, thinking, toolCalls });
              }
            }
          } catch (_) {}
        }
      });
      res.on('end', () => { if (!settled) finish({ content, thinking, toolCalls }); });
    });

    req.on('error', (e) => {
      if (abortState.aborted) { finish({ content, thinking, toolCalls }); return; }
      if (!settled) { settled = true; abortState.destroy = null; reject(e); }
    });

    abortState.destroy = () => { req.destroy(); finish({ content, thinking, toolCalls }); };

    req.write(payload);
    req.end();
  });
}

function parseEmulatedToolCall(content) {
  const match = TOOL_CALL_TAG_RE.exec(content);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && parsed.name) return parsed;
  } catch (_) { /* fall through */ }
  return null;
}

function normalizeToolArgs(rawArgs) {
  if (rawArgs == null) return {};
  if (typeof rawArgs === 'string') {
    try { return JSON.parse(rawArgs); } catch (_) { return {}; }
  }
  return rawArgs;
}

function buildToolPreview(name, args) {
  if (name === 'write_file') {
    return 'Write ' + args.path + ':\n\n' + (args.content || '');
  }
  if (name === 'edit_file') {
    return 'In ' + args.path + ', replace:\n' + args.old_string + '\n\nwith:\n' + args.new_string;
  }
  if (name === 'run_command') {
    return '$ ' + args.command + (args.cwd ? '  (in ' + args.cwd + ')' : '');
  }
  return JSON.stringify(args);
}

// Shared tool-calling loop used by both Ollama and Gemini.
async function runToolLoop({ model, messages, systemPrompt, temperature, supportsTools, event, channelPrefix, streamFn, projectRoot }) {
  const abortState = { aborted: false, destroy: null };
  let pendingApprovalReject = null;

  const stopHandler = () => {
    abortState.aborted = true;
    if (pendingApprovalReject) pendingApprovalReject();
    if (abortState.destroy) abortState.destroy();
    event.sender.send(channelPrefix + '-chat-done', { aborted: true });
  };
  ipcMain.once(channelPrefix + '-stop', stopHandler);

  function waitForApproval(id) {
    return new Promise((resolve) => {
      pendingApprovalReject = () => resolve(false);
      ipcMain.once(channelPrefix + '-tool-response-' + id, (_event, { approved }) => {
        pendingApprovalReject = null;
        resolve(approved);
      });
    });
  }

  async function runToolCall(toolCall) {
    const name = toolCall.function ? toolCall.function.name : toolCall.name;
    const args = normalizeToolArgs(toolCall.function ? toolCall.function.arguments : toolCall.arguments);
    const id = 'tool-' + Math.random().toString(36).slice(2) + '-' + name;
    const def = getToolByName(name);

    if (!def) {
      const outcome = { ok: false, error: 'Unknown tool: ' + name };
      event.sender.send(channelPrefix + '-tool-result', { id, name, ...outcome, provider: channelPrefix === 'gemini' ? 'gemini' : 'ollama' });
      return outcome;
    }

    if (def.approvalRequired) {
      event.sender.send(channelPrefix + '-tool-request', { id, name, arguments: args, preview: buildToolPreview(name, args), provider: channelPrefix === 'gemini' ? 'gemini' : 'ollama' });
      const approved = await waitForApproval(id);
      if (abortState.aborted) return { ok: false, error: 'Stopped by user.' };
      if (!approved) {
        const outcome = { ok: false, error: 'The user denied this action.' };
        event.sender.send(channelPrefix + '-tool-result', { id, name, ...outcome, provider: channelPrefix === 'gemini' ? 'gemini' : 'ollama' });
        return outcome;
      }
    } else {
      event.sender.send(channelPrefix + '-tool-auto', { id, name, arguments: args, provider: channelPrefix === 'gemini' ? 'gemini' : 'ollama' });
    }

    const outcome = await executeTool(name, args, projectRoot);
    event.sender.send(channelPrefix + '-tool-result', { id, name, ok: outcome.ok, result: outcome.result, error: outcome.error, provider: channelPrefix === 'gemini' ? 'gemini' : 'ollama' });
    if (outcome.changedFile) {
      event.sender.send('ai-tool-file-changed', outcome.changedFile);
    }
    return outcome;
  }

  try {
    let conversation = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages.slice();

    if (!supportsTools) {
      conversation = [{ role: 'system', content: buildEmulationPromptBlock() }, ...conversation];
    }

    const nativeTools = supportsTools ? toOllamaToolSchemas() : undefined;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS && !abortState.aborted; iteration++) {
      const result = await streamFn({
        model,
        messages: conversation,
        tools: nativeTools,
        temperature,
        liveStream: !!supportsTools,
        onChunk: (chunk) => event.sender.send(channelPrefix + '-chat-chunk', chunk),
        onThinking: (chunk) => event.sender.send(channelPrefix + '-chat-thinking', chunk),
        abortState,
      });

      if (result && result.error) {
        if (!abortState.aborted) event.sender.send(channelPrefix + '-chat-error', result.error);
        break;
      }

      const { content, toolCalls } = result;
      if (abortState.aborted) break;

      let callsThisRound = toolCalls;
      let emulatedCall = null;
      if ((!callsThisRound || !callsThisRound.length) && !supportsTools) {
        emulatedCall = parseEmulatedToolCall(content);
        if (emulatedCall) callsThisRound = [emulatedCall];
      }

      if (!callsThisRound || !callsThisRound.length) {
        if (!supportsTools && content) {
          event.sender.send(channelPrefix + '-chat-chunk', content);
        }
        break;
      }

      conversation.push({ role: 'assistant', content, tool_calls: supportsTools ? toolCalls : undefined });

      for (const call of callsThisRound) {
        const outcome = await runToolCall(call);
        if (abortState.aborted) break;
        const name = call.function ? call.function.name : call.name;
        if (supportsTools) {
          conversation.push({ role: 'tool', tool_name: name, content: JSON.stringify(outcome) });
        } else {
          conversation.push({ role: 'user', content: 'Tool result for ' + name + ':\n' + JSON.stringify(outcome) });
        }
      }

      if (iteration === MAX_TOOL_ITERATIONS - 1 && !abortState.aborted) {
        event.sender.send(channelPrefix + '-chat-chunk', '\n\n(Stopped after ' + MAX_TOOL_ITERATIONS + ' tool calls without a final answer.)');
      }
    }

    if (!abortState.aborted) event.sender.send(channelPrefix + '-chat-done', {});
  } catch (e) {
    if (!abortState.aborted) event.sender.send(channelPrefix + '-chat-error', e.message);
  } finally {
    ipcMain.removeListener(channelPrefix + '-stop', stopHandler);
  }
}

module.exports = () => {
  //ipcMain listeners

  ipcMain.on('ollama-chat', async (event, { model, messages, systemPrompt, temperature, supportsTools, projectRoot }) => {
    await runToolLoop({
      model, messages, systemPrompt, temperature, supportsTools,
      event,
      channelPrefix: 'ollama',
      streamFn: streamChat,
      projectRoot,
    });
  });

  ipcMain.on('gemini-chat', async (event, { model, messages, systemPrompt, temperature, projectRoot, apiKey }) => {
    const geminiStreamFn = (params) => streamGeminiChat({ ...params, apiKey });
    await runToolLoop({
      model, messages, systemPrompt, temperature,
      supportsTools: true,
      event,
      channelPrefix: 'gemini',
      streamFn: geminiStreamFn,
      projectRoot,
    });
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
            source: m.remote_host ? 'cloud' : 'local',
            supportsTools: (m.capabilities || []).includes('tools'),
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

  // ---- Gemini BYOK handlers ----
  ipcMain.on('gemini-list-models', (event, { apiKey }) => {
    https.get('https://generativelanguage.googleapis.com/v1/models?key=' + encodeURIComponent(apiKey), (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          var errType = 'invalidKey';
          try {
            var e = JSON.parse(body);
            if (e.error && (e.error.status === 'RESOURCE_EXHAUSTED' || e.error.status === 'QUOTA_EXCEEDED')) {
              errType = 'quotaExceeded';
            }
          } catch (_) {}
          event.sender.send('gemini-models-list', { error: errType });
          return;
        }
        try {
          var data = JSON.parse(body);
          var models = (data.models || [])
            .filter(function (m) { return m.supportedGenerationMethods && m.supportedGenerationMethods.indexOf('generateContent') !== -1; })
            .map(function (m) {
              return {
                name: m.name.replace('models/', ''),
                provider: 'gemini',
                source: 'cloud',
                supportsTools: true,
              };
            });
          event.sender.send('gemini-models-list', { models: models });
        } catch (e) {
          event.sender.send('gemini-models-list', { error: 'invalidKey' });
        }
      });
    }).on('error', function () {
      event.sender.send('gemini-models-list', { error: 'invalidKey' });
    });
  });

  ipcMain.on('gemini-get-key', (event) => {
    var keyPath = path.join(app.getPath('userData'), 'gemini_key.json');
    fs.readFile(keyPath, 'utf8', function (err, data) {
      if (err) {
        event.sender.send('gemini-get-key-response', { key: null });
        return;
      }
      try {
        var parsed = JSON.parse(data);
        event.sender.send('gemini-get-key-response', { key: parsed.key || null });
      } catch (e) {
        event.sender.send('gemini-get-key-response', { key: null });
      }
    });
  });

  ipcMain.on('gemini-set-key', (event, { apiKey }) => {
    var keyPath = path.join(app.getPath('userData'), 'gemini_key.json');
    fs.writeFile(keyPath, JSON.stringify({ key: apiKey }), 'utf8', function (err) {
      event.sender.send('gemini-set-key-response', { success: !err });
    });
  });

  // ---- Real PTY terminal (Git Bash via node-pty in a system-Node child process) ----
  const { spawn: spawnChild } = require('child_process');
  let ptyChild = null;

  function sendToPty(msg) {
    if (ptyChild && ptyChild.stdin.writable) {
      ptyChild.stdin.write(JSON.stringify(msg) + '\n');
    }
  }

  function killPtyChild() {
    if (ptyChild) {
      try { ptyChild.kill(); } catch (e) { /* ignore */ }
      ptyChild = null;
    }
  }

  ipcMain.on('terminal-spawn', (event, { cwd, cols, rows }) => {
    killPtyChild();

    // Spawn ptyHost.js under the SYSTEM node so node-pty's native bindings
    // (compiled against the system Node ABI) load correctly.
    const hostScript = path.join(__dirname, 'ptyHost.js');
    ptyChild = spawnChild('node', [hostScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    // Forward PTY data to the renderer
    let dataBuf = '';
    ptyChild.stdout.on('data', (chunk) => {
      dataBuf += chunk.toString();
      let idx;
      while ((idx = dataBuf.indexOf('\n')) !== -1) {
        const line = dataBuf.slice(0, idx).trim();
        dataBuf = dataBuf.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'data') {
            event.sender.send('terminal-data', msg.data);
          } else if (msg.type === 'exit') {
            event.sender.send('terminal-exit', msg.exitCode);
          }
        } catch (e) { /* skip */ }
      }
    });

    ptyChild.stderr.on('data', (chunk) => {
      console.error('[ptyHost stderr]', chunk.toString());
    });

    ptyChild.on('close', () => {
      ptyChild = null;
    });

    // Tell the host to spawn the shell
    sendToPty({ type: 'spawn', cwd: cwd, cols: cols, rows: rows });
  });

  ipcMain.on('terminal-input', (event, data) => {
    sendToPty({ type: 'input', data: data });
  });

  ipcMain.on('terminal-resize', (event, { cols, rows }) => {
    sendToPty({ type: 'resize', cols: cols, rows: rows });
  });

  ipcMain.on('terminal-kill', () => {
    sendToPty({ type: 'kill' });
    killPtyChild();
  });
};
