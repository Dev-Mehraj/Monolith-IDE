import React from 'react';
import PropTypes from 'prop-types';

const { getFileIconPath } = require('../../lib/materialIcons');

class Tab extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { pressed: false };
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  handleMouseDown() {
    this.setState({ pressed: true });
  }

  handleMouseUp() {
    this.setState({ pressed: false });
  }

  render() {
    const { name, isActive, setActiveTab, path, closeTab } = this.props;
    const { pressed } = this.state;

    return (
      <li
        className={"texteditor tab " + (isActive ? "active" : "")}
        onClick={() => setActiveTab(path)}
        onMouseDown={this.handleMouseDown}
        onMouseUp={this.handleMouseUp}
        onMouseLeave={this.handleMouseUp}
        style={{
          transform: pressed ? 'scale(0.96)' : 'scale(1)',
          transition: 'transform 100ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="title" style={{ display: 'flex', alignItems: 'center' }}>
          <img src={getFileIconPath(name)} style={{ width: 14, height: 14, marginRight: 5, flexShrink: 0 }} />
          {name}
        </div>
        <div className="close-icon" onClick={(event) => closeTab(path, event)} />
      </li>
    );
  }
}

Tab.propTypes = {
  name: PropTypes.string.isRequired,
  isActive: PropTypes.bool.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  path: PropTypes.string.isRequired,
  closeTab: PropTypes.func.isRequired,
};

export default Tab;
