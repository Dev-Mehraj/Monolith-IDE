import React, { Component } from 'react';

class FloatingPanel extends Component {
  constructor(props) {
    super(props);

    const savedState = this.loadSavedState();

    this.state = {
      position: savedState.position || { x: 20, y: 20 },
      size: savedState.size || { width: 420, height: 520 },
      isDragging: false,
      isResizing: false,
      dragOffset: { x: 0, y: 0 },
      closeHovered: false,
    };

    this.panelRef = React.createRef();
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
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  }

  saveState(position, size) {
    try {
      localStorage.setItem('ollama_panel_state', JSON.stringify({ position, size }));
    } catch (e) {}
  }

  handleMouseDown(e) {
    if (e.target.closest('.floating-panel-header') && !e.target.closest('.fp-close-btn')) {
      const rect = this.panelRef.current.getBoundingClientRect();
      this.setState({
        isDragging: true,
        dragOffset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
      e.preventDefault();
    }
  }

  handleResizeMouseDown(e) {
    if (e.target.closest('.floating-panel-resize-handle')) {
      this.setState({
        isResizing: true,
        resizeStartSize: { ...this.state.size },
        resizeStartPos: { x: e.clientX, y: e.clientY },
      });
      e.preventDefault();
      e.stopPropagation();
    }
  }

  handleMouseMove(e) {
    if (this.state.isDragging) {
      this.setState({
        position: {
          x: Math.max(0, e.clientX - this.state.dragOffset.x),
          y: Math.max(0, e.clientY - this.state.dragOffset.y),
        },
      });
    }
    if (this.state.isResizing) {
      const dx = e.clientX - this.state.resizeStartPos.x;
      const dy = e.clientY - this.state.resizeStartPos.y;
      this.setState({
        size: {
          width: Math.max(this.props.minWidth || 300, this.state.resizeStartSize.width + dx),
          height: Math.max(this.props.minHeight || 200, this.state.resizeStartSize.height + dy),
        },
      });
    }
  }

  handleMouseUp() {
    if (this.state.isDragging || this.state.isResizing) {
      this.saveState(this.state.position, this.state.size);
    }
    this.setState({ isDragging: false, isResizing: false });
  }

  componentDidMount() {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  componentWillUnmount() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  render() {
    const { position, size, isDragging, isResizing, closeHovered } = this.state;
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
          overflow: 'hidden',
          userSelect: isDragging || isResizing ? 'none' : 'auto',
        }}
        onMouseDown={this.handleMouseDown}
      >
        <div
          className="floating-panel-header"
          style={{
            padding: '10px 14px',
            cursor: 'move',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{
            color: '#00f0ff',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            textShadow: '0 0 10px rgba(0, 240, 255, 0.3)',
          }}>
            {title || 'AI Chat'}
          </span>
          {this.props.onClose && (
            <button
              className="fp-close-btn"
              onClick={this.props.onClose}
              onMouseEnter={() => this.setState({ closeHovered: true })}
              onMouseLeave={() => this.setState({ closeHovered: false })}
              style={{
                background: closeHovered ? 'rgba(255, 45, 149, 0.15)' : 'transparent',
                border: 'none',
                color: closeHovered ? '#ff2d95' : '#64748b',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                padding: '2px 6px',
                borderRadius: '4px',
                transition: 'all 150ms ease',
                transform: closeHovered ? 'scale(1.1)' : 'scale(1)',
              }}
              title="Close"
            >
              ×
            </button>
          )}
        </div>

        <div
          className="floating-panel-content"
          style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          {children}
        </div>

        <div
          className="floating-panel-resize-handle"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '20px',
            height: '20px',
            cursor: 'se-resize',
            background: 'linear-gradient(135deg, transparent 50%, rgba(0, 240, 255, 0.2) 50%)',
            borderBottomRightRadius: '10px',
          }}
          onMouseDown={this.handleResizeMouseDown}
        />
      </div>
    );
  }
}

export default FloatingPanel;
