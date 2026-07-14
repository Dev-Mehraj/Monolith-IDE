import React from 'react';
import RenameForm from './RenameForm';
import PropTypes from 'prop-types';
import CreateMenu from './CreateMenu';

const { getFileIconPath } = require('../../lib/materialIcons');

const fileIconStyle = {
  width: 16,
  height: 16,
  marginRight: 6,
  verticalAlign: 'middle',
  flexShrink: 0,
};

const File = ({ file, dblClickHandler, selectedItem, id, clickHandler, renameFlag, renameHandler, openCreateMenu, openMenuId, createMenuHandler}) => {
  return (
    <li
      className={selectedItem.id === id ? 'list-item selected' : 'list-item'}
      onDoubleClick={(event) => dblClickHandler(file, event)}
      onClick={(event) => clickHandler(id, file.path, file.type, event)}
      onContextMenu ={(event) => openCreateMenu(id, file.path, file.type, event)}
    >
    {openMenuId === id ? <CreateMenu createMenuHandler={createMenuHandler} path = {file.path} type = {file.type} id={id} /> : <span />}
    {renameFlag && selectedItem.id === id
        ? <RenameForm renameHandler={renameHandler} />
        : <span style={{ display: 'flex', alignItems: 'center' }}>
            <img src={getFileIconPath(file.name)} style={fileIconStyle} />
            {file.name}
          </span>}
    </li>
  );
};


File.propTypes = {
  file: PropTypes.object.isRequired,
  dblClickHandler: PropTypes.func.isRequired,
  selectedItem: PropTypes.object.isRequired,
  id: PropTypes.number.isRequired,
  clickHandler: PropTypes.func.isRequired,
  renameFlag: PropTypes.bool.isRequired,
  renameHandler: PropTypes.func.isRequired
};

export default File;
