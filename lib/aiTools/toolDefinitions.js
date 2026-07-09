'use strict';

// Provider-agnostic tool schemas shared by the native Ollama tool-calling path
// and the prompt-emulation fallback for models without native tool support.
// Each entry doubles as an Ollama-style function schema and as the source
// for the emulation prompt's tool list.

const TOOLS = [
  {
    name: 'find_files',
    description: 'Recursively search for files by name/extension under the project. Use this first to discover what exists before reading.',
    approvalRequired: false,
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Substring or glob-like pattern to match against file names, e.g. "*.jsx" or "AiChatPanel".' },
        dir: { type: 'string', description: 'Directory to search in, relative to the project root. Defaults to the project root.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the full contents of a single file, with line numbers, so you can quote exact text for edit_file.',
    approvalRequired: false,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file, relative to the project root (or absolute, if inside the project).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create a new file or completely overwrite an existing one. Requires user approval. Prefer edit_file for changes to existing files.',
    approvalRequired: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file, relative to the project root (or absolute, if inside the project).' },
        content: { type: 'string', description: 'Full content to write to the file.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Replace one exact, unique occurrence of old_string with new_string in an existing file. Use this instead of write_file to change only the specific lines that need to change. old_string must match the file contents exactly, including whitespace, and must occur exactly once.',
    approvalRequired: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file, relative to the project root (or absolute, if inside the project).' },
        old_string: { type: 'string', description: 'The exact text to find. Must appear exactly once in the file.' },
        new_string: { type: 'string', description: 'The text to replace it with.' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'run_command',
    description: 'Run a one-off shell command in the project directory and return its stdout/stderr/exit code. Requires user approval.',
    approvalRequired: true,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to run.' },
        cwd: { type: 'string', description: 'Working directory, relative to the project root. Defaults to the project root.' },
      },
      required: ['command'],
    },
  },
];

function getToolByName(name) {
  return TOOLS.find(t => t.name === name);
}

// Ollama's native /api/chat "tools" param shape: { type: 'function', function: { name, description, parameters } }
function toOllamaToolSchemas() {
  return TOOLS.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Human/LLM-readable block describing the tools and the required call format,
// injected into the system prompt for models without native tool support.
function buildEmulationPromptBlock() {
  const toolList = TOOLS.map(t => {
    return '- ' + t.name + '(' + Object.keys(t.parameters.properties).join(', ') + '): ' + t.description;
  }).join('\n');

  return [
    'You have access to the following tools:',
    toolList,
    '',
    'To call a tool, respond with ONLY a single line in this exact format and nothing else:',
    '<tool_call>{"name": "tool_name", "arguments": {"arg1": "value1"}}</tool_call>',
    'Wait for the tool result before continuing. If you do not need a tool, just answer normally.',
  ].join('\n');
}

module.exports = {
  TOOLS,
  getToolByName,
  toOllamaToolSchemas,
  buildEmulationPromptBlock,
};
