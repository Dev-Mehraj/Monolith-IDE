import React from 'react';
import PropTypes from 'prop-types';

const { getFileExt, getCssClassByFileExt } = require('../../lib/file-tree.js');

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
        <div className={"title " + getCssClassByFileExt(getFileExt(name))}>{name}</div>
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
