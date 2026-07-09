import React from 'react';
import PropTypes from 'prop-types';

const CreateMenu = ({ id, createMenuHandler, type, path }) => {
  let contextMenu;
  if (type === 'directory') {
    contextMenu = (
      <div>
        <button className="create-button" onClick={(event) => createMenuHandler(id, 'file', event, 'create')}>New File</button>
        <button className="create-button" onClick={(event) => createMenuHandler(id, 'directory', event, 'create')}>New Directory</button>
        <div style={{ height: '1px', background: 'rgba(0, 240, 255, 0.08)', margin: '2px 8px' }} />
        <button className="create-button" onClick={(event) => createMenuHandler(id, type, event, 'rename')}>Rename</button>
        <button className="create-button" onClick={(event) => createMenuHandler(id, type, event, 'delete', path)} style={{ color: '#ff2d95' }}>Delete</button>
      </div>
    );
  } else {
    contextMenu = (
      <div>
        <button className="create-button" onClick={(event) => createMenuHandler(id, type, event, 'rename')}>Rename</button>
        <button className="create-button" onClick={(event) => createMenuHandler(id, type, event, 'delete', path)} style={{ color: '#ff2d95' }}>Delete</button>
      </div>
    );
  }
  return (
    <div className="create-menu">
      {contextMenu}
    </div>
  );
};

CreateMenu.propTypes = {
  id: PropTypes.number.isRequired,
  createMenuHandler: PropTypes.func.isRequired,
};

export default CreateMenu;
