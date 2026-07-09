import React from 'react';
import PropTypes from 'prop-types';

class DeleteButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hovered: false, pressed: false };
  }

  render() {
    const { onClick, label, variant } = this.props;
    const { hovered, pressed } = this.state;

    const isDestructive = variant === 'danger';
    const baseColor = isDestructive ? '#ff2d95' : '#64748b';

    return (
      <button
        onClick={onClick}
        onMouseEnter={() => this.setState({ hovered: true })}
        onMouseLeave={() => this.setState({ hovered: false, pressed: false })}
        onMouseDown={() => this.setState({ pressed: true })}
        onMouseUp={() => this.setState({ pressed: false })}
        style={{
          transform: pressed ? 'scale(0.93)' : hovered ? 'translateY(-2px)' : 'none',
          boxShadow: hovered && isDestructive
            ? '0 4px 20px rgba(255, 45, 149, 0.4)'
            : hovered
              ? '0 4px 15px rgba(0, 0, 0, 0.3)'
              : 'none',
          transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {label}
      </button>
    );
  }
}

const DeletePrompt = ({ deletePromptHandler, name }) => {
  return (
    <div className="delete-prompt">
      <h1>Delete <span style={{ color: '#ff2d95' }}>{name}</span>?</h1>
      <DeleteButton onClick={() => deletePromptHandler(false)} label="CANCEL" variant="cancel" />
      <DeleteButton onClick={() => deletePromptHandler(true)} label="DELETE" variant="danger" />
    </div>
  );
};

DeletePrompt.propTypes = {
  deletePromptHandler: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
};

export default DeletePrompt;
