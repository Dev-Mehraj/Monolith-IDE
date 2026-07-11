import React from "react";
const { ipcRenderer } = require("electron");

const SLASH_COMMANDS = {
  "/explain": "Explain the following code in detail:\n\n",
  "/fix": "Find and fix bugs in this code:\n\n",
  "/tests": "Write unit tests for this code:\n\n",
  "/doc": "Generate documentation for this code:\n\n",
  "/optimize": "Optimize this code for performance:\n\n",
  "/review": "Review this code for issues:\n\n",
  "/clear": null,
  "/help": null,
};

const STORAGE_KEY = "monolith_chat_history";
const SYSTEM_PROMPT =
  "You are an expert AI software designer, You must help with writing code, short explanation more work on code.\n  You are running INSIDE an IDE named Monolith.\n Also in this monolith IDE when you create or delete files it doesnt automatically update it, so always tell the user to click refresh button located in file explorer of this IDE to to view deleted or created files, that refresh button is above the file explorer right next to file directory heading.";

export default class AiChatPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      models: [],
      selectedModel: "",
      messages: [],
      inputValue: "",
      isLoading: false,
      temperature: 0.7,
      isNearBottom: true,
      nvidiaApiKeyPrompt: false,
      nvidiaKeyInput: '',
      nvidiaError: null,
      nvidiaSavingKey: false,
    };

    this._nvidiaApiKey = null;

    this.messagesEndRef = React.createRef();
    this.messagesContainerRef = React.createRef();
    this.inputRef = React.createRef();

    this.handleModelsList = this.handleModelsList.bind(this);
    this.handleChunk = this.handleChunk.bind(this);
    this.handleThinkingChunk = this.handleThinkingChunk.bind(this);
    this.handleToggleThinking = this.handleToggleThinking.bind(this);
    this.handleDone = this.handleDone.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleToolAuto = this.handleToolAuto.bind(this);
    this.handleToolRequest = this.handleToolRequest.bind(this);
    this.handleToolResult = this.handleToolResult.bind(this);
    this.handleApprove = this.handleApprove.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleInputKeyDown = this.handleInputKeyDown.bind(this);
    this.handleSend = this.handleSend.bind(this);
    this.handleModelChange = this.handleModelChange.bind(this);
    this.handleTemperatureChange = this.handleTemperatureChange.bind(this);
    this.handleClearChat = this.handleClearChat.bind(this);
    this.handleStop = this.handleStop.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleNewChat = this.handleNewChat.bind(this);
    this.loadHistory = this.loadHistory.bind(this);
    this.saveHistory = this.saveHistory.bind(this);
    this.insertActiveFileContext = this.insertActiveFileContext.bind(this);
    this.handleNvidiaModelsList = this.handleNvidiaModelsList.bind(this);
    this.handleNvidiaKeyResponse = this.handleNvidiaKeyResponse.bind(this);
    this.handleNvidiaSetKeyResponse = this.handleNvidiaSetKeyResponse.bind(this);
    this.handleSaveNvidiaKey = this.handleSaveNvidiaKey.bind(this);
    this.handleDismissNvidiaPrompt = this.handleDismissNvidiaPrompt.bind(this);
  }

  componentDidMount() {
    ipcRenderer.on("ollama-models-list", this.handleModelsList);
    ipcRenderer.on("ollama-chat-chunk", this.handleChunk);
    ipcRenderer.on("nvidia-chat-chunk", this.handleChunk);
    ipcRenderer.on("ollama-chat-thinking", this.handleThinkingChunk);
    ipcRenderer.on("nvidia-chat-thinking", this.handleThinkingChunk);
    ipcRenderer.on("ollama-chat-done", this.handleDone);
    ipcRenderer.on("nvidia-chat-done", this.handleDone);
    ipcRenderer.on("ollama-chat-error", this.handleError);
    ipcRenderer.on("nvidia-chat-error", this.handleError);
    ipcRenderer.on("ollama-tool-auto", this.handleToolAuto);
    ipcRenderer.on("nvidia-tool-auto", this.handleToolAuto);
    ipcRenderer.on("ollama-tool-request", this.handleToolRequest);
    ipcRenderer.on("nvidia-tool-request", this.handleToolRequest);
    ipcRenderer.on("ollama-tool-result", this.handleToolResult);
    ipcRenderer.on("nvidia-tool-result", this.handleToolResult);
    ipcRenderer.on("nvidia-models-list", this.handleNvidiaModelsList);
    ipcRenderer.on("nvidia-get-key-response", this.handleNvidiaKeyResponse);
    ipcRenderer.on("nvidia-set-key-response", this.handleNvidiaSetKeyResponse);
    ipcRenderer.send("ollama-list-models");
    ipcRenderer.send("nvidia-get-key");

    this.loadHistory();
  }

  componentWillUnmount() {
    ipcRenderer.removeListener("ollama-models-list", this.handleModelsList);
    ipcRenderer.removeListener("ollama-chat-chunk", this.handleChunk);
    ipcRenderer.removeListener("nvidia-chat-chunk", this.handleChunk);
    ipcRenderer.removeListener(
      "ollama-chat-thinking",
      this.handleThinkingChunk,
    );
    ipcRenderer.removeListener(
      "nvidia-chat-thinking",
      this.handleThinkingChunk,
    );
    ipcRenderer.removeListener("ollama-chat-done", this.handleDone);
    ipcRenderer.removeListener("nvidia-chat-done", this.handleDone);
    ipcRenderer.removeListener("ollama-chat-error", this.handleError);
    ipcRenderer.removeListener("nvidia-chat-error", this.handleError);
    ipcRenderer.removeListener("ollama-tool-auto", this.handleToolAuto);
    ipcRenderer.removeListener("nvidia-tool-auto", this.handleToolAuto);
    ipcRenderer.removeListener("ollama-tool-request", this.handleToolRequest);
    ipcRenderer.removeListener("nvidia-tool-request", this.handleToolRequest);
    ipcRenderer.removeListener("ollama-tool-result", this.handleToolResult);
    ipcRenderer.removeListener("nvidia-tool-result", this.handleToolResult);
    ipcRenderer.removeListener(
      "nvidia-models-list",
      this.handleNvidiaModelsList,
    );
    ipcRenderer.removeListener(
      "nvidia-get-key-response",
      this.handleNvidiaKeyResponse,
    );
    ipcRenderer.removeListener(
      "nvidia-set-key-response",
      this.handleNvidiaSetKeyResponse,
    );
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
      if (lastMsg && lastMsg.role === "assistant") {
        lastMsg.content += chunk;
      }
      return { messages: messages, isLoading: true };
    });
  }

  handleThinkingChunk(event, chunk) {
    this.setState(function (prevState) {
      var messages = prevState.messages.slice();
      var lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        lastMsg.thinking = (lastMsg.thinking || "") + chunk;
        if (lastMsg.thinkingExpanded === undefined)
          lastMsg.thinkingExpanded = true;
      }
      return { messages: messages, isLoading: true };
    });
  }

  handleToggleThinking(index) {
    this.setState(function (prevState) {
      var messages = prevState.messages.slice();
      var msg = messages[index];
      if (msg) msg.thinkingExpanded = !msg.thinkingExpanded;
      return { messages: messages };
    });
  }

  handleDone(event, data) {
    if (data && data.aborted) {
      this.setState({ isLoading: false });
      return;
    }
    var self = this;
    this.setState(
      function (prevState) {
        var messages = prevState.messages.slice();
        var lastMsg = messages[messages.length - 1];
        if (
          lastMsg &&
          lastMsg.role === "assistant" &&
          !lastMsg.content.trim()
        ) {
          lastMsg.content = "(no response)";
        }
        return { messages: messages, isLoading: false };
      },
      function () {
        self.saveHistory();
      },
    );
  }

  handleError(event, errorMessage) {
    var self = this;
    self.setState(
      function (prevState) {
        return {
          isLoading: false,
          messages: prevState.messages.concat([
            { role: "assistant", content: "Error: " + errorMessage },
          ]),
        };
      },
      function () {
        self.saveHistory();
      },
    );
  }

  handleToolAuto(event, data) {
    var self = this;
    this.setState(
      function (prevState) {
        var messages = prevState.messages.concat([
          {
            role: "tool",
            id: data.id,
            name: data.name,
            args: data.arguments,
            executionStatus: "running",
          },
          { role: "assistant", content: "" },
        ]);
        return { messages: messages };
      },
      function () {
        self.saveHistory();
      },
    );
  }

  handleToolRequest(event, data) {
    var self = this;
    this.setState(
      function (prevState) {
        var messages = prevState.messages.concat([
          {
            role: "tool-approval",
            id: data.id,
            name: data.name,
            args: data.arguments,
            preview: data.preview,
            approvalStatus: "pending",
            executionStatus: "idle",
          },
          { role: "assistant", content: "" },
        ]);
        return { messages: messages };
      },
      function () {
        self.saveHistory();
      },
    );
  }

  handleToolResult(event, data) {
    var self = this;
    this.setState(
      function (prevState) {
        var messages = prevState.messages.slice();
        var msg = messages.find(function (m) {
          return m.id === data.id;
        });
        if (msg) {
          msg.executionStatus = data.ok ? "done" : "error";
          msg.result = data.result;
          msg.error = data.error;
          if (
            msg.role === "tool-approval" &&
            msg.approvalStatus === "pending"
          ) {
            msg.approvalStatus = data.ok ? "approved" : "denied";
          }
        }
        return { messages: messages };
      },
      function () {
        self.saveHistory();
      },
    );
  }

  handleApprove(id, approved) {
    var self = this;
    this.setState(
      function (prevState) {
        var messages = prevState.messages.slice();
        var msg = messages.find(function (m) {
          return m.id === id;
        });
        if (msg) {
          msg.approvalStatus = approved ? "approved" : "denied";
          msg.executionStatus = approved ? "running" : "done";
        }
        return { messages: messages };
      },
      function () {
        var msg = self.state.messages.find(function (m) {
          return m.id === id;
        });
        var prefix = msg && msg.provider === "nvidia" ? "nvidia" : "ollama";
        ipcRenderer.send(prefix + "-tool-response-" + id, {
          approved: approved,
        });
      },
    );
  }

  handleNvidiaModelsList(event, data) {
    var self = this;
    if (data.error) {
      self.setState({ nvidiaError: data.error, nvidiaApiKeyPrompt: data.error === 'invalidKey' });
      return;
    }
    self.setState(function (prevState) {
      var existing = prevState.models.filter(function (m) { return m.provider !== 'nvidia'; });
      return { models: existing.concat(data.models || []), nvidiaError: null, nvidiaApiKeyPrompt: false };
    });
  }

  handleNvidiaKeyResponse(event, data) {
    if (data.key) {
      this._nvidiaApiKey = data.key;
      ipcRenderer.send('nvidia-list-models', { apiKey: data.key });
    } else {
      this.setState({ nvidiaApiKeyPrompt: true });
    }
  }

  handleNvidiaSetKeyResponse(event, data) {
    if (data.success) {
      ipcRenderer.send('nvidia-list-models', { apiKey: this._nvidiaApiKey });
      this.setState({ nvidiaSavingKey: false, nvidiaError: null });
    }
  }

  handleSaveNvidiaKey() {
    var key = this.state.nvidiaKeyInput;
    if (!key.trim()) return;
    this._nvidiaApiKey = key.trim();
    this.setState({ nvidiaSavingKey: true, nvidiaKeyInput: '' });
    ipcRenderer.send('nvidia-set-key', { apiKey: this._nvidiaApiKey });
  }

  handleDismissNvidiaPrompt() {
    this.setState({ nvidiaApiKeyPrompt: false });
  }

  handleModelChange(e) {
    this.setState({ selectedModel: e.target.value });
  }

  handleTemperatureChange(e) {
    this.setState({ temperature: parseFloat(e.target.value) });
  }

  handleInputChange(e) {
    this.setState({ inputValue: e.target.value });
  }

  handleInputKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.handleSend();
    }
  }

  handleSend() {
    var state = this.state;
    var inputValue = state.inputValue;
    var selectedModel = state.selectedModel;
    var messages = state.messages;
    var systemPrompt = SYSTEM_PROMPT;
    var temperature = state.temperature;
    var isLoading = state.isLoading;

    if (!inputValue.trim() || isLoading || !selectedModel) return;

    var cmd = inputValue.trim().split(/\s+/)[0].toLowerCase();
    var content = inputValue;

    if (SLASH_COMMANDS[cmd] !== undefined) {
      if (cmd === "/clear") {
        this.handleClearChat();
        return;
      }
      if (cmd === "/help") {
        var helpLines = Object.keys(SLASH_COMMANDS)
          .filter(function (k) {
            return SLASH_COMMANDS[k] !== null;
          })
          .map(function (k) {
            return "  " + k;
          });
        this.setState(
          {
            messages: messages.concat([
              { role: "user", content: inputValue },
              {
                role: "assistant",
                content:
                  "Available commands:\n" +
                  helpLines.join("\n") +
                  "\n\nCommands without templates: /clear, /help",
              },
            ]),
            inputValue: "",
          },
          this.saveHistory,
        );
        return;
      }
      var rest = inputValue.slice(cmd.length).trim();
      content = SLASH_COMMANDS[cmd] + (rest || "");
    }

    var newMessages = messages.concat([{ role: "user", content: content }]);
    var displayMessages = newMessages.concat([
      { role: "assistant", content: "" },
    ]);
    var selectedModelInfo = state.models.find(function (m) {
      return m.name === selectedModel;
    });
    var isNvidia = selectedModelInfo && selectedModelInfo.provider === "nvidia";
    var self = this;
    this._activeProvider = null;
    this.setState(
      { messages: displayMessages, inputValue: "", isLoading: true },
      function () {
        var payload = {
          model: selectedModel,
          messages: newMessages.filter(function (m) {
            return m.role === "user" || m.role === "assistant";
          }),
          systemPrompt: systemPrompt,
          temperature: temperature,
          projectRoot: self.props.rootDirPath || "",
        };
        if (isNvidia) {
          payload.apiKey = self._nvidiaApiKey;
          self._activeProvider = "nvidia";
          ipcRenderer.send("nvidia-chat", payload);
        } else {
          payload.supportsTools = !!(
            selectedModelInfo && selectedModelInfo.supportsTools
          );
          self._activeProvider = "ollama";
          ipcRenderer.send("ollama-chat", payload);
        }
      },
    );
  }

  handleStop() {
    var provider = this._activeProvider || "ollama";
    ipcRenderer.send(provider + "-stop");
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
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    this.setState({ isNearBottom: isNearBottom });
  }

  scrollToBottom() {
    if (this.messagesEndRef.current) {
      this.messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }

  saveHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.state.messages.slice(-100)),
      );
    } catch (e) {
      console.error("Failed to save chat history:", e);
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
      console.error("Failed to load chat history:", e);
    }
  }

  insertActiveFileContext() {
    var filePath = this.props.activeFilePath;
    if (filePath) {
      this.setState({
        inputValue: this.state.inputValue + "\n\nFile: " + filePath + "\n",
      });
      if (this.inputRef.current) {
        this.inputRef.current.focus();
      }
    }
  }

  renderNvidiaPrompt() {
    var nvidiaKeyInput = this.state.nvidiaKeyInput;
    var nvidiaSavingKey = this.state.nvidiaSavingKey;
    var self = this;

    return (
      <div
        style={{
          padding: "16px 12px",
          borderBottom: "1px solid rgba(0, 240, 255, 0.08)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#64748b",
            fontSize: "11px",
            marginBottom: "10px",
            letterSpacing: "0.5px",
          }}
        >
          ENTER NVIDIA NIM API KEY
        </div>
        <input
          type="password"
          value={nvidiaKeyInput}
          onChange={function (e) {
            self.setState({ nvidiaKeyInput: e.target.value });
          }}
          placeholder="Paste your NVIDIA NIM API key..."
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "#050a12",
            color: "#e2e8f0",
            border: "1px solid rgba(0, 240, 255, 0.15)",
            borderRadius: "6px",
            fontSize: "12px",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            marginBottom: "8px",
          }}
        />
        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
          <button
            onClick={this.handleSaveNvidiaKey}
            disabled={!nvidiaKeyInput.trim() || nvidiaSavingKey}
            style={{
              padding: "6px 16px",
              background:
                nvidiaKeyInput.trim() && !nvidiaSavingKey
                  ? "linear-gradient(135deg, rgba(0, 128, 255, 0.3), rgba(0, 240, 255, 0.2))"
                  : "rgba(30, 41, 59, 0.5)",
              color:
                nvidiaKeyInput.trim() && !nvidiaSavingKey
                  ? "#00f0ff"
                  : "#2a3550",
              border:
                nvidiaKeyInput.trim() && !nvidiaSavingKey
                  ? "1px solid rgba(0, 240, 255, 0.3)"
                  : "1px solid transparent",
              borderRadius: "6px",
              cursor:
                nvidiaKeyInput.trim() && !nvidiaSavingKey
                  ? "pointer"
                  : "default",
              fontSize: "11px",
              fontWeight: "600",
              letterSpacing: "0.5px",
              fontFamily: "inherit",
            }}
          >
            {nvidiaSavingKey ? "SAVING..." : "SAVE"}
          </button>
          <button
            onClick={this.handleDismissNvidiaPrompt}
            style={{
              padding: "6px 16px",
              background: "transparent",
              color: "#64748b",
              border: "1px solid rgba(0, 240, 255, 0.08)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600",
              fontFamily: "inherit",
            }}
          >
            SKIP
          </button>
        </div>
      </div>
    );
  }

  renderNvidiaErrorBanner() {
    var nvidiaError = this.state.nvidiaError;
    var self = this;

    if (!nvidiaError) return null;

    var messages = {
      invalidKey: "NVIDIA NIM: check your API key",
      quotaExceeded: "NVIDIA NIM: quota exceeded",
    };

    return (
      <div
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid rgba(255, 45, 149, 0.15)",
          background: "rgba(255, 45, 149, 0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span style={{ color: "#ff2d95", fontSize: "11px" }}>
          {messages[nvidiaError] || "NVIDIA NIM: check your API key"}
        </span>
        <button
          onClick={function () {
            self.setState({ nvidiaApiKeyPrompt: true, nvidiaError: null });
          }}
          style={{
            padding: "3px 10px",
            background: "rgba(255, 45, 149, 0.1)",
            color: "#ff2d95",
            border: "1px solid rgba(255, 45, 149, 0.2)",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "10px",
            fontWeight: "600",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          UPDATE KEY
        </button>
      </div>
    );
  }

  renderModelSelector() {
    var models = this.state.models;
    var selectedModel = this.state.selectedModel;

    var localModels = models.filter(function (m) {
      return m.source === "local";
    });
    var cloudModels = models.filter(function (m) {
      return m.source !== "local";
    });

    return (
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid rgba(0, 240, 255, 0.08)",
        }}
      >
        <select
          value={selectedModel}
          onChange={this.handleModelChange}
          style={{
            width: "100%",
            padding: "7px 10px",
            background: "#0a0f1a",
            color: "#e2e8f0",
            border: "1px solid rgba(0, 240, 255, 0.15)",
            borderRadius: "6px",
            fontSize: "12px",
            outline: "none",
            fontFamily: "inherit",
          }}
        >
          <option value="">Select a model...</option>
          {localModels.length > 0 && (
            <optgroup label="Local Models">
              {localModels.map(function (m) {
                return (
                  <option key={m.name} value={m.name}>
                    {m.name + (m.supportsTools ? " [tools]" : "")}
                  </option>
                );
              })}
            </optgroup>
          )}
          {cloudModels.length > 0 && (
            <optgroup label="Cloud Models">
              {cloudModels.map(function (m) {
                return (
                  <option key={m.name} value={m.name}>
                    {m.name + (m.supportsTools ? " [tools]" : "")}
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>
      </div>
    );
  }

  renderTemperatureSlider() {
    var temperature = this.state.temperature;

    return (
      <div
        style={{
          padding: "5px 12px",
          borderBottom: "1px solid rgba(0, 240, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <label
          style={{ color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" }}
        >
          {"Temp: " + temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={this.handleTemperatureChange}
          style={{
            flex: 1,
            height: "4px",
            cursor: "pointer",
            accentColor: "#00f0ff",
          }}
        />
      </div>
    );
  }

  renderToolCard(msg, i) {
    var statusIcon =
      msg.executionStatus === "running"
        ? ">"
        : msg.executionStatus === "error"
          ? "!"
          : "*";
    var argsSummary = msg.args ? JSON.stringify(msg.args) : "";
    var resultSummary =
      msg.executionStatus === "error"
        ? msg.error
        : msg.result
          ? JSON.stringify(msg.result).slice(0, 500)
          : "";

    return (
      <div
        key={i}
        style={{
          marginBottom: "10px",
          padding: "8px 10px",
          borderRadius: "8px",
          background: "rgba(0, 255, 136, 0.04)",
          borderLeft: "2px solid #00ff88",
          fontSize: "12px",
        }}
      >
        <div
          style={{
            color: "#00ff88",
            fontWeight: "600",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          {"[" + statusIcon + "] " + msg.name + "(" + argsSummary + ")"}
        </div>
        {resultSummary && (
          <div
            style={{
              color: "#4a5568",
              marginTop: "4px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "monospace",
              fontSize: "11px",
            }}
          >
            {resultSummary}
          </div>
        )}
      </div>
    );
  }

  renderApprovalCard(msg, i) {
    var self = this;
    var statusLabel = {
      pending: "Awaiting authorization",
      approved:
        msg.executionStatus === "running"
          ? "Executing..."
          : msg.executionStatus === "error"
            ? "Failed"
            : "Authorized",
      denied: "Denied",
    }[msg.approvalStatus];

    return (
      <div
        key={i}
        style={{
          marginBottom: "10px",
          padding: "10px 12px",
          borderRadius: "8px",
          background: "rgba(255, 107, 43, 0.05)",
          borderLeft: "2px solid #ff6b2b",
          fontSize: "12px",
        }}
      >
        <div
          style={{
            color: "#ff6b2b",
            fontWeight: "600",
            marginBottom: "6px",
            fontSize: "11px",
            letterSpacing: "0.5px",
          }}
        >
          {"TOOL: " + msg.name}
        </div>
        <pre
          style={{
            margin: 0,
            padding: "8px",
            background: "#050a12",
            borderRadius: "6px",
            color: "#94a3b8",
            fontSize: "11px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: "160px",
            overflowY: "auto",
            border: "1px solid rgba(0, 240, 255, 0.08)",
            fontFamily: "monospace",
          }}
        >
          {msg.preview}
        </pre>
        {msg.approvalStatus === "pending" ? (
          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
            <button
              onClick={function () {
                self.handleApprove(msg.id, true);
              }}
              style={{
                padding: "5px 14px",
                background:
                  "linear-gradient(135deg, rgba(0, 128, 255, 0.3), rgba(0, 240, 255, 0.2))",
                color: "#00f0ff",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "0.5px",
                fontFamily: "inherit",
                transition: "all 150ms",
              }}
            >
              APPROVE
            </button>
            <button
              onClick={function () {
                self.handleApprove(msg.id, false);
              }}
              style={{
                padding: "5px 14px",
                background: "rgba(30, 41, 59, 0.5)",
                color: "#64748b",
                border: "1px solid rgba(0, 240, 255, 0.08)",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "600",
                fontFamily: "inherit",
                transition: "all 150ms",
              }}
            >
              DENY
            </button>
          </div>
        ) : (
          <div style={{ color: "#64748b", marginTop: "6px", fontSize: "11px" }}>
            {statusLabel}
          </div>
        )}
        {msg.executionStatus === "error" && msg.error && (
          <div style={{ color: "#ff2d95", marginTop: "4px", fontSize: "11px" }}>
            {msg.error}
          </div>
        )}
        {msg.executionStatus === "done" && msg.result && (
          <pre
            style={{
              margin: "6px 0 0",
              padding: "8px",
              background: "#050a12",
              borderRadius: "6px",
              color: "#4a5568",
              fontSize: "11px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "160px",
              overflowY: "auto",
              fontFamily: "monospace",
              border: "1px solid rgba(0, 240, 255, 0.08)",
            }}
          >
            {JSON.stringify(msg.result).slice(0, 800)}
          </pre>
        )}
      </div>
    );
  }

  renderMessages() {
    var messages = this.state.messages;
    var isLoading = this.state.isLoading;
    var self = this;

    return (
      <div
        ref={this.messagesContainerRef}
        onScroll={this.handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 12px",
          background: "#050a12",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "#2a3550",
              fontSize: "12px",
              textAlign: "center",
              marginTop: "40px",
              lineHeight: "1.8",
            }}
          >
            <div
              style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.5 }}
            >
              &#9672;
            </div>
            Neural link ready.
            <br />
            Type <strong style={{ color: "#00f0ff" }}>/help</strong> for
            commands.
          </div>
        )}
        {messages.map(function (msg, i) {
          if (msg.role === "tool") {
            return self.renderToolCard(msg, i);
          }
          if (msg.role === "tool-approval") {
            return self.renderApprovalCard(msg, i);
          }
          var hasThinking =
            msg.role === "assistant" && msg.thinking && msg.thinking.trim();
          if (msg.role === "assistant" && !msg.content.trim() && !hasThinking) {
            return null;
          }
          var isUser = msg.role === "user";
          return (
            <div
              key={i}
              style={{
                marginBottom: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: isUser
                  ? "rgba(0, 128, 255, 0.06)"
                  : "rgba(0, 240, 255, 0.04)",
                borderLeft: "2px solid " + (isUser ? "#0080ff" : "#00f0ff"),
                animation: "fadeInUp 200ms ease-out",
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: isUser ? "#0080ff" : "#00f0ff",
                  marginBottom: "6px",
                  textShadow:
                    "0 0 8px " +
                    (isUser ? "rgba(0,128,255,0.3)" : "rgba(0,240,255,0.3)"),
                }}
              >
                {isUser ? "YOU" : "AI"}
              </div>
              {hasThinking && (
                <div style={{ marginBottom: msg.content.trim() ? "6px" : "0" }}>
                  <button
                    onClick={function () {
                      self.handleToggleThinking(i);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      fontSize: "11px",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontFamily: "inherit",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        transform: msg.thinkingExpanded
                          ? "rotate(0)"
                          : "rotate(-90deg)",
                        transition: "transform 200ms",
                      }}
                    >
                      ▼
                    </span>
                    <span>Thinking</span>
                  </button>
                  {msg.thinkingExpanded && (
                    <div
                      style={{
                        color: "#4a5568",
                        fontSize: "12px",
                        fontStyle: "italic",
                        lineHeight: "1.4",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        marginTop: "4px",
                        paddingLeft: "8px",
                        borderLeft: "1px solid rgba(0, 240, 255, 0.15)",
                      }}
                    >
                      {msg.thinking}
                    </div>
                  )}
                </div>
              )}
              {msg.content.trim() && (
                <div
                  style={{
                    color: "#e2e8f0",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              )}
            </div>
          );
        })}
        {isLoading && (
          <div
            style={{
              marginBottom: "10px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "rgba(0, 240, 255, 0.04)",
              borderLeft: "2px solid #00f0ff",
              color: "#64748b",
              fontSize: "12px",
            }}
          >
            <span className="thinking-indicator">Processing</span>
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
    var canSend = inputValue.trim() && selectedModel;

    return (
      <div
        style={{
          borderTop: "1px solid rgba(0, 240, 255, 0.08)",
          padding: "10px 12px",
          background: "#0d1320",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
          <textarea
            ref={this.inputRef}
            value={inputValue}
            onChange={this.handleInputChange}
            onKeyDown={this.handleInputKeyDown}
            placeholder={
              selectedModel ? "Enter command..." : "Select model first..."
            }
            disabled={!selectedModel}
            rows={2}
            style={{
              flex: 1,
              padding: "8px 10px",
              background: "#050a12",
              color: "#e2e8f0",
              border: "1px solid rgba(0, 240, 255, 0.12)",
              borderRadius: "8px",
              fontSize: "13px",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: "1.4",
              transition: "border-color 200ms",
            }}
            onFocus={function (e) {
              e.target.style.borderColor = "rgba(0, 240, 255, 0.3)";
            }}
            onBlur={function (e) {
              e.target.style.borderColor = "rgba(0, 240, 255, 0.12)";
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {isLoading ? (
              <button
                onClick={this.handleStop}
                title="Stop"
                style={{
                  flex: 1,
                  padding: "6px 14px",
                  background: "rgba(255, 45, 149, 0.15)",
                  color: "#ff2d95",
                  border: "1px solid rgba(255, 45, 149, 0.3)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  fontFamily: "inherit",
                  transition: "all 150ms",
                }}
              >
                &#9632;
              </button>
            ) : (
              <button
                onClick={this.handleSend}
                disabled={!canSend}
                title="Send"
                style={{
                  flex: 1,
                  padding: "6px 14px",
                  background: canSend
                    ? "linear-gradient(135deg, rgba(0, 128, 255, 0.3), rgba(0, 240, 255, 0.2))"
                    : "rgba(30, 41, 59, 0.5)",
                  color: canSend ? "#00f0ff" : "#2a3550",
                  border: canSend
                    ? "1px solid rgba(0, 240, 255, 0.3)"
                    : "1px solid transparent",
                  borderRadius: "8px",
                  cursor: canSend ? "pointer" : "default",
                  fontSize: "12px",
                  fontWeight: "600",
                  letterSpacing: "0.5px",
                  fontFamily: "inherit",
                  transition: "all 200ms",
                  textShadow: canSend
                    ? "0 0 10px rgba(0, 240, 255, 0.3)"
                    : "none",
                }}
              >
                SEND
              </button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            onClick={this.handleNewChat}
            title="New chat"
            style={{
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid rgba(0, 240, 255, 0.12)",
              borderRadius: "6px",
              color: "#64748b",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "inherit",
              transition: "all 150ms",
            }}
            onMouseEnter={function (e) {
              e.target.style.borderColor = "rgba(0, 240, 255, 0.3)";
              e.target.style.color = "#00f0ff";
            }}
            onMouseLeave={function (e) {
              e.target.style.borderColor = "rgba(0, 240, 255, 0.12)";
              e.target.style.color = "#64748b";
            }}
          >
            New Chat
          </button>
          {this.props.activeFilePath && (
            <button
              onClick={this.insertActiveFileContext}
              title="Insert active file path"
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid rgba(0, 240, 255, 0.12)",
                borderRadius: "6px",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "11px",
                fontFamily: "inherit",
                transition: "all 150ms",
              }}
              onMouseEnter={function (e) {
                e.target.style.borderColor = "rgba(0, 240, 255, 0.3)";
                e.target.style.color = "#00f0ff";
              }}
              onMouseLeave={function (e) {
                e.target.style.borderColor = "rgba(0, 240, 255, 0.12)";
                e.target.style.color = "#64748b";
              }}
            >
              + File
            </button>
          )}
          <div style={{ flex: 1 }} />
          <span
            style={{
              color: "#2a3550",
              fontSize: "10px",
              letterSpacing: "0.5px",
            }}
          >
            {this.state.models.length > 0
              ? this.state.models.length + " models"
              : "No models"}
          </span>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: "#0a0f1a",
          color: "#e2e8f0",
          fontFamily: "inherit",
        }}
      >
        {this.renderModelSelector()}
        {this.renderTemperatureSlider()}
        {this.state.nvidiaApiKeyPrompt && this.renderNvidiaPrompt()}
        {this.renderNvidiaErrorBanner()}
        {this.renderMessages()}
        {this.renderInputBar()}
      </div>
    );
  }
}
