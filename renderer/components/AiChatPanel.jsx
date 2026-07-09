import React from 'react';
const { ipcRenderer } = require('electron');

const SLASH_COMMANDS = {
  '/explain': 'Explain the following code in detail:\n\n',
  '/fix': 'Find and fix bugs in this code:\n\n',
  '/tests': 'Write unit tests for this code:\n\n',
  '/doc': 'Generate documentation for this code:\n\n',
  '/optimize': 'Optimize this code for performance:\n\n',
  '/review': 'Review this code for issues:\n\n',
  '/clear': null,
  '/help': null,
};

const STORAGE_KEY = 'monolith_chat_history';
const SYSTEM_PROMPT_KEY = 'monolith_system_prompt';

export default class AiChatPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      models: [],
      selectedModel: '',
      messages: [],
      inputValue: '',
      isLoading: false,
      showSystemPrompt: false,
      systemPrompt: '',
      temperature: 0.7,
      isNearBottom: true,
    };

    this.messagesEndRef = React.createRef();
    this.messagesContainerRef = React.createRef();
    this.inputRef = React.createRef();

    this.handleModelsList = this.handleModelsList.bind(this);
    this.handleChunk = this.handleChunk.bind(this);
    this.handleDone = this.handleDone.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleInputKeyDown = this.handleInputKeyDown.bind(this);
    this.handleSend = this.handleSend.bind(this);
    this.handleModelChange = this.handleModelChange.bind(this);
    this.handleTemperatureChange = this.handleTemperatureChange.bind(this);
    this.handleSystemPromptChange = this.handleSystemPromptChange.bind(this);
    this.handleClearChat = this.handleClearChat.bind(this);
    this.handleStop = this.handleStop.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleNewChat = this.handleNewChat.bind(this);
    this.loadHistory = this.loadHistory.bind(this);
    this.saveHistory = this.saveHistory.bind(this);
    this.insertActiveFileContext = this.insertActiveFileContext.bind(this);
  }

  componentDidMount() {
    ipcRenderer.on('ollama-models-list', this.handleModelsList);
    ipcRenderer.on('ollama-chat-chunk', this.handleChunk);
    ipcRenderer.on('ollama-chat-done', this.handleDone);
    ipcRenderer.on('ollama-chat-error', this.handleError);
    ipcRenderer.send('ollama-list-models');

    var savedSystemPrompt = localStorage.getItem(SYSTEM_PROMPT_KEY);
    if (savedSystemPrompt) {
      this.setState({ systemPrompt: savedSystemPrompt });
    }

    this.loadHistory();
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('ollama-models-list', this.handleModelsList);
    ipcRenderer.removeListener('ollama-chat-chunk', this.handleChunk);
    ipcRenderer.removeListener('ollama-chat-done', this.handleDone);
    ipcRenderer.removeListener('ollama-chat-error', this.handleError);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.messages.length !== prevState.messages.length) {
      if (this.state.isNearBottom) {
        this.scrollToBottom();
      }
    }
  }

  handleModelsList(event, models) {
    var self = this;
    self.setState({ models: models || [] }, function () {
      if (models && models.length > 0 && !self.state.selectedModel) {
        self.setState({ selectedModel: models[0].name });
      }
    });
  }

  handleChunk(event, chunk) {
    this.setState(function (prevState) {
      var messages = prevState.messages.slice();
      var lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content += chunk;
      }
      return { messages: messages, isLoading: true };
    });
  }

  handleDone(event, data) {
    if (data && data.aborted) {
      this.setState({ isLoading: false });
      return;
    }
    var self = this;
    this.setState(function (prevState) {
      var messages = prevState.messages.slice();
      var lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content.trim()) {
        lastMsg.content = '(no response)';
      }
      return { messages: messages, isLoading: false };
    }, function () {
      self.saveHistory();
    });
  }

  handleError(event, errorMessage) {
    var self = this;
    self.setState(function (prevState) {
      return {
        isLoading: false,
        messages: prevState.messages.concat([
          { role: 'assistant', content: 'Error: ' + errorMessage },
        ]),
      };
    }, function () {
      self.saveHistory();
    });
  }

  handleModelChange(e) {
    this.setState({ selectedModel: e.target.value });
  }

  handleTemperatureChange(e) {
    this.setState({ temperature: parseFloat(e.target.value) });
  }

  handleSystemPromptChange(e) {
    this.setState({ systemPrompt: e.target.value });
    localStorage.setItem(SYSTEM_PROMPT_KEY, e.target.value);
  }

  handleInputChange(e) {
    this.setState({ inputValue: e.target.value });
  }

  handleInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSend();
    }
  }

  handleSend() {
    var state = this.state;
    var inputValue = state.inputValue;
    var selectedModel = state.selectedModel;
    var messages = state.messages;
    var systemPrompt = state.systemPrompt;
    var temperature = state.temperature;
    var isLoading = state.isLoading;

    if (!inputValue.trim() || isLoading || !selectedModel) return;

    var cmd = inputValue.trim().split(/\s+/)[0].toLowerCase();
    var content = inputValue;

    if (SLASH_COMMANDS[cmd] !== undefined) {
      if (cmd === '/clear') {
        this.handleClearChat();
        return;
      }
      if (cmd === '/help') {
        var helpLines = Object.keys(SLASH_COMMANDS)
          .filter(function (k) { return SLASH_COMMANDS[k] !== null; })
          .map(function (k) { return '  ' + k; });
        this.setState({
          messages: messages.concat([
            { role: 'user', content: inputValue },
            { role: 'assistant', content: 'Available commands:\n' + helpLines.join('\n') + '\n\nCommands without templates: /clear, /help' },
          ]),
          inputValue: '',
        }, this.saveHistory);
        return;
      }
      var rest = inputValue.slice(cmd.length).trim();
      content = SLASH_COMMANDS[cmd] + (rest || '');
    }

    var newMessages = messages.concat([{ role: 'user', content: content }]);
    var displayMessages = newMessages.concat([{ role: 'assistant', content: '' }]);
    var self = this;
    this.setState({ messages: displayMessages, inputValue: '', isLoading: true }, function () {
      ipcRenderer.send('ollama-chat', {
        model: selectedModel,
        messages: newMessages,
        systemPrompt: systemPrompt || undefined,
        temperature: temperature,
      });
    });
  }

  handleStop() {
    ipcRenderer.send('ollama-stop');
    this.setState({ isLoading: false });
  }

  handleClearChat() {
    this.setState({ messages: [] }, function () {
      localStorage.removeItem(STORAGE_KEY);
    });
  }

  handleNewChat() {
    this.handleClearChat();
  }

  handleScroll() {
    var container = this.messagesContainerRef.current;
    if (!container) return;
    var threshold = 100;
    var isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    this.setState({ isNearBottom: isNearBottom });
  }

  scrollToBottom() {
    if (this.messagesEndRef.current) {
      this.messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }

  saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.messages.slice(-100)));
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }

  loadHistory() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.setState({ messages: parsed });
        }
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  }

  insertActiveFileContext() {
    var filePath = this.props.activeFilePath;
    if (filePath) {
      this.setState({ inputValue: this.state.inputValue + '\n\nFile: ' + filePath + '\n' });
      if (this.inputRef.current) {
        this.inputRef.current.focus();
      }
    }
  }

  renderModelSelector() {
    var models = this.state.models;
    var selectedModel = this.state.selectedModel;

    var localModels = models.filter(function (m) { return m.source === 'local'; });
    var cloudModels = models.filter(function (m) { return m.source !== 'local'; });

    return (
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #333' }}>
        <select
          value={selectedModel}
          onChange={this.handleModelChange}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: '#2a2a2a',
            color: '#e0e0e0',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '12px',
            outline: 'none',
          }}
        >
          <option value="">Select a model...</option>
          {localModels.length > 0 && (
            <optgroup label="Local Models">
              {localModels.map(function (m) {
                return <option key={m.name} value={m.name}>{m.name}</option>;
              })}
            </optgroup>
          )}
          {cloudModels.length > 0 && (
            <optgroup label="Cloud Models">
              {cloudModels.map(function (m) {
                return <option key={m.name} value={m.name}>{m.name}</option>;
              })}
            </optgroup>
          )}
        </select>
      </div>
    );
  }

  renderSystemPromptEditor() {
    var showSystemPrompt = this.state.showSystemPrompt;
    var systemPrompt = this.state.systemPrompt;
    var self = this;

    return (
      <div style={{ borderBottom: '1px solid #333' }}>
        <button
          onClick={function () { self.setState({ showSystemPrompt: !showSystemPrompt }); }}
          style={{
            width: '100%',
            padding: '4px 12px',
            background: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '11px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{showSystemPrompt ? '▼' : '▶'}</span>
          System Prompt
        </button>
        {showSystemPrompt && (
          <textarea
            value={systemPrompt}
            onChange={this.handleSystemPromptChange}
            placeholder="Enter a system prompt to set the AI's behavior..."
            rows={3}
            style={{
              width: '100%',
              padding: '6px 12px',
              background: '#1a1a1a',
              color: '#ccc',
              border: 'none',
              borderTop: '1px solid #333',
              fontSize: '11px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>
    );
  }

  renderTemperatureSlider() {
    var temperature = this.state.temperature;

    return (
      <div
        style={{
          padding: '4px 12px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <label style={{ color: '#888', fontSize: '11px', whiteSpace: 'nowrap' }}>
          {'Temp: ' + temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={this.handleTemperatureChange}
          style={{ flex: 1, height: '4px', cursor: 'pointer' }}
        />
      </div>
    );
  }

  renderMessages() {
    var messages = this.state.messages;
    var isLoading = this.state.isLoading;

    return (
      <div
        ref={this.messagesContainerRef}
        onScroll={this.handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          background: '#1e1e1e',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: '#555',
              fontSize: '12px',
              textAlign: 'center',
              marginTop: '40px',
              lineHeight: '1.6',
            }}
          >
            Start a conversation with the AI.
            <br />
            Type <strong style={{ color: '#777' }}>/help</strong> for commands.
          </div>
        )}
        {messages.map(function (msg, i) {
          return (
            <div
              key={i}
              style={{
                marginBottom: '12px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: msg.role === 'user' ? '#2a3a4a' : '#2a2a2a',
                borderLeft: '3px solid ' + (msg.role === 'user' ? '#4a90d9' : '#6a9955'),
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: msg.role === 'user' ? '#4a90d9' : '#6a9955',
                  marginBottom: '4px',
                }}
              >
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
              <div
                style={{
                  color: '#e0e0e0',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div
            style={{
              marginBottom: '12px',
              padding: '8px 10px',
              borderRadius: '6px',
              background: '#2a2a2a',
              borderLeft: '3px solid #6a9955',
              color: '#888',
              fontSize: '12px',
            }}
          >
            <span className="thinking-indicator">Thinking</span>
          </div>
        )}
        <div ref={this.messagesEndRef} />
      </div>
    );
  }

  renderInputBar() {
    var inputValue = this.state.inputValue;
    var isLoading = this.state.isLoading;
    var selectedModel = this.state.selectedModel;

    return (
      <div
        style={{
          borderTop: '1px solid #333',
          padding: '8px 12px',
          background: '#252525',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
          <textarea
            ref={this.inputRef}
            value={inputValue}
            onChange={this.handleInputChange}
            onKeyDown={this.handleInputKeyDown}
            placeholder={
              selectedModel
                ? 'Type a message or / for commands...'
                : 'Select a model first...'
            }
            disabled={!selectedModel}
            rows={2}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: '#1a1a1a',
              color: '#e0e0e0',
              border: '1px solid #444',
              borderRadius: '6px',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.4',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {isLoading ? (
              <button
                onClick={this.handleStop}
                title="Stop generating"
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: '#b33',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                ■
              </button>
            ) : (
              <button
                onClick={this.handleSend}
                disabled={!inputValue.trim() || !selectedModel}
                title="Send message"
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: inputValue.trim() && selectedModel ? '#3a8fe0' : '#333',
                  color: inputValue.trim() && selectedModel ? '#fff' : '#666',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: inputValue.trim() && selectedModel ? 'pointer' : 'default',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                Send
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={this.handleNewChat}
            title="New chat"
            style={{
              padding: '3px 8px',
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            New Chat
          </button>
          {this.props.activeFilePath && (
            <button
              onClick={this.insertActiveFileContext}
              title="Insert active file path"
              style={{
                padding: '3px 8px',
                background: 'transparent',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#888',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              + File
            </button>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ color: '#555', fontSize: '10px' }}>
            {this.state.models.length > 0
              ? this.state.models.length + ' model(s) available'
              : 'No models found'}
          </span>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#1e1e1e',
          color: '#e0e0e0',
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        }}
      >
        {this.renderModelSelector()}
        {this.renderSystemPromptEditor()}
        {this.renderTemperatureSlider()}
        {this.renderMessages()}
        {this.renderInputBar()}
      </div>
    );
  }
}
