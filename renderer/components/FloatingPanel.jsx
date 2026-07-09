import React, { Component } from 'react';

class FloatingPanel extends Component {
  constructor(props) {
    super(props);

    // Load saved position/size from localStorage or use defaults
    const savedState = this.loadSavedState();

    this.state = {
      position: savedState.position || { x: 20, y: 20 },
      size: savedState.size || { width: 400, height: 500 },
      isDragging: false,
      isResizing: false,
      dragOffset: { x: 0, y: 0 }
    };

    this.panelRef = React.createRef();
    this.dragStartPos = null;
    this.resizeStartSize = null;
    this.resizeStartPos = null;

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleResizeMouseDown = this.handleResizeMouseDown.bind(this);
  }

  loadSavedState() {
    try {
      const saved = localStorage.getItem('ollama_panel_state');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load panel state:', e);
    }
    return {};
  }

  saveState(position, size) {
    try {
      localStorage.setItem('ollama_panel_state', JSON.stringify({ position, size }));
    } catch (e) {
      console.error('Failed to save panel state:', e);
    }
  }

  handleMouseDown(e) {
    // Only start dragging from the header
    if (e.target.closest('.floating-panel-header')) {
      const rect = this.panelRef.current.getBoundingClientRect();
      this.setState({
        isDragging: true,
        dragOffset: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
      });
      e.preventDefault();
    }
  }

  handleResizeMouseDown(e) {
    // Only start resizing from the resize handle
    if (e.target.closest('.floating-panel-resize-handle')) {
      this.setState({
        isResizing: true,
        resizeStartSize: { ...this.state.size },
        resizeStartPos: { x: e.clientX, y: e.clientY }
      });
      e.preventDefault();
      e.stopPropagation();
    }
  }

  handleMouseMove(e) {
    if (this.state.isDragging) {
      const newX = e.clientX - this.state.dragOffset.x;
      const newY = e.clientY - this.state.dragOffset.y;

      this.setState({
        position: { x: Math.max(0, newX), y: Math.max(0, newY) }
      });
    }

    if (this.state.isResizing) {
      const deltaX = e.clientX - this.state.resizeStartPos.x;
      const deltaY = e.clientY - this.state.resizeStartPos.y;

      const minWidth = this.props.minWidth || 300;
      const minHeight = this.props.minHeight || 200;

      const newWidth = Math.max(minWidth, this.state.resizeStartSize.width + deltaX);
      const newHeight = Math.max(minHeight, this.state.resizeStartSize.height + deltaY);

      this.setState({
        size: { width: newWidth, height: newHeight }
      });
    }
  }

  handleMouseUp() {
    if (this.state.isDragging || this.state.isResizing) {
      // Save state when done dragging/resizing
      this.saveState(this.state.position, this.state.size);
    }

    this.setState({
      isDragging: false,
      isResizing: false
    });
  }

  componentDidMount() {
    // Add global mouse listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  componentWillUnmount() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  render() {
    const { position, size, isDragging, isResizing } = this.state;
    const { title, children, className } = this.props;

    return (
      <div
        ref={this.panelRef}
        className={`floating-panel ${className || ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1e1e1e',
          border: '1px solid #333',
          borderRadius: '8px',
          boxShadow: isDragging || isResizing
            ? '0 10px 40px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          userSelect: isDragging || isResizing ? 'none' : 'auto'
        }}
        onMouseDown={this.handleMouseDown}
      >
        {/* Header */}
        <div
          className="floating-panel-header"
          style={{
            padding: '8px 12px',
            backgroundColor: '#2a2a2a',
            borderBottom: '1px solid #333',
            cursor: 'move',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <span style={{ color: '#ccc', fontSize: '13px', fontWeight: '500' }}>
            {title || 'AI Chat'}
          </span>
          {this.props.onClose && (
            <button
              onClick={this.props.onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                padding: '0 2px',
              }}
              title="Close"
            >
              ×
            </button>
          )}
        </div>

        {/* Content */}
        <div
          className="floating-panel-content"
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {children}
        </div>

        {/* Resize Handle */}
        <div
          className="floating-panel-resize-handle"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '20px',
            height: '20px',
            cursor: 'se-resize',
            background: 'linear-gradient(135deg, transparent 50%, #555 50%)',
            borderBottomRightRadius: '6px'
          }}
          onMouseDown={this.handleResizeMouseDown}
        />

        {/* CSS for the panel */}
        <style>{`
          .floating-panel {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .floating-panel.dragging,
          .floating-panel.resizing {
            opacity: 0.9;
          }
          .floating-panel-header:hover {
            background-color: #333 !important;
          }
        `}</style>
      </div>
    );
  }
}

export default FloatingPanel;
