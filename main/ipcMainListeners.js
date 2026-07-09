'use strict';

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
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

module.exports = () => {
  //ipcMain listeners

  ipcMain.on('ollama-chat', async (event, { model, messages, systemPrompt, temperature, supportsTools, projectRoot }) => {
    const abortState = { aborted: false, destroy: null };
    let pendingApprovalReject = null;

    const stopHandler = () => {
      abortState.aborted = true;
      if (pendingApprovalReject) pendingApprovalReject();
      if (abortState.destroy) abortState.destroy();
      event.sender.send('ollama-chat-done', { aborted: true });
    };
    ipcMain.once('ollama-stop', stopHandler);

    function waitForApproval(id) {
      return new Promise((resolve) => {
        pendingApprovalReject = () => resolve(false);
        ipcMain.once('ollama-tool-response-' + id, (_event, { approved }) => {
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
        event.sender.send('ollama-tool-result', { id, name, ...outcome });
        return outcome;
      }

      if (def.approvalRequired) {
        event.sender.send('ollama-tool-request', { id, name, arguments: args, preview: buildToolPreview(name, args) });
        const approved = await waitForApproval(id);
        if (abortState.aborted) return { ok: false, error: 'Stopped by user.' };
        if (!approved) {
          const outcome = { ok: false, error: 'The user denied this action.' };
          event.sender.send('ollama-tool-result', { id, name, ...outcome });
          return outcome;
        }
      } else {
        event.sender.send('ollama-tool-auto', { id, name, arguments: args });
      }

      const outcome = await executeTool(name, args, projectRoot);
      event.sender.send('ollama-tool-result', { id, name, ok: outcome.ok, result: outcome.result, error: outcome.error });
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
        const { content, toolCalls } = await streamChat({
          model,
          messages: conversation,
          tools: nativeTools,
          temperature,
          liveStream: !!supportsTools,
          onChunk: (chunk) => event.sender.send('ollama-chat-chunk', chunk),
          onThinking: (chunk) => event.sender.send('ollama-chat-thinking', chunk),
          abortState,
        });

        if (abortState.aborted) break;

        let callsThisRound = toolCalls;
        let emulatedCall = null;
        if ((!callsThisRound || !callsThisRound.length) && !supportsTools) {
          emulatedCall = parseEmulatedToolCall(content);
          if (emulatedCall) callsThisRound = [emulatedCall];
        }

        if (!callsThisRound || !callsThisRound.length) {
          // Final answer for this turn.
          if (!supportsTools && content) {
            event.sender.send('ollama-chat-chunk', content);
          }
          break;
        }

        // Assistant's turn included tool call(s) - record it, then run each tool.
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
          event.sender.send('ollama-chat-chunk', '\n\n(Stopped after ' + MAX_TOOL_ITERATIONS + ' tool calls without a final answer.)');
        }
      }

      if (!abortState.aborted) event.sender.send('ollama-chat-done', {});
    } catch (e) {
      if (!abortState.aborted) event.sender.send('ollama-chat-error', e.message);
    } finally {
      ipcMain.removeListener('ollama-stop', stopHandler);
    }
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
};
