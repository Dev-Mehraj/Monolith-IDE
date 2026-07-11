import React from 'react';
import Tab from './Tab';
import PropTypes from 'prop-types';

function handleHMRButtonClick(event, callback) {
  event.stopPropagation();
  if (callback) callback();
}

class ToolbarButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hovered: false, pressed: false };
  }

  render() {
    const { onClick, icon, title } = this.props;
    const { hovered, pressed } = this.state;

    return (
      <div
        className="btn"
        onClick={onClick}
        title={title}
        onMouseEnter={() => this.setState({ hovered: true })}
        onMouseLeave={() => this.setState({ hovered: false, pressed: false })}
        onMouseDown={() => this.setState({ pressed: true })}
        onMouseUp={() => this.setState({ pressed: false })}
        style={{
          transform: pressed ? 'scale(0.85)' : hovered ? 'translateY(-2px)' : 'none',
          background: hovered ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
          color: hovered ? '#00f0ff' : '#64748b',
          boxShadow: hovered ? '0 2px 12px rgba(0, 240, 255, 0.2)' : 'none',
          transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
          width: '30px',
          height: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        <i className={icon} />
      </div>
    );
  }
}

const TabContainer = ({
  appState,
  setActiveTab,
  closeTab,
  cbOpenSimulator_Main,
  cbOpenSimulator_Ext,
  close,
  toggleTerminal,
  showNvidiaButton,
  onNvidiaClick,
}) => {
  const tabs = [];
  for (let key in appState.openTabs) {
    tabs.push(
      <Tab
        key={key}
        name={appState.openTabs[key].name}
        isActive={appState.previousPaths[appState.previousPaths.length - 1] === key}
        setActiveTab={setActiveTab}
        path={key}
        closeTab={closeTab}
      />
    );
  }
  return (
    <div id="editor-tabbar-container">
      <div id="editor-tabbar-left">
        <ul className="list-inline tab-bar inset-panel tab-container">
          {tabs}
        </ul>
      </div>
      <div id="editor-tabbar-right">
        <div id="btn-hmr-group">
          <ToolbarButton
            onClick={close}
            icon="fas fa-window-maximize fa-rotate-270"
            title="Toggle sidebar"
          />
          <ToolbarButton
            onClick={(event) => handleHMRButtonClick(event, cbOpenSimulator_Main)}
            icon="fas fa-window-maximize"
            title="Open simulator inline"
          />
          <ToolbarButton
            onClick={(event) => handleHMRButtonClick(event, cbOpenSimulator_Ext)}
            icon="fas fa-window-restore"
            title="Open simulator external"
          />
          <ToolbarButton
            onClick={toggleTerminal}
            icon="fas fa-window-maximize fa-rotate-180"
            title="Toggle terminal"
          />
          {showNvidiaButton && (
            <ToolbarButton
              onClick={onNvidiaClick}
              icon="fas fa-key"
              title="NVIDIA NIM"
            />
          )}
        </div>
      </div>
    </div>
  );
};

TabContainer.propTypes = {
  appState: PropTypes.object.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  closeTab: PropTypes.func.isRequired,
};

export default TabContainer;
