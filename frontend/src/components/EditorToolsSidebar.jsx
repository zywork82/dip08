import React from 'react';
import '../styles/EditorToolsSidebar.css';

const nodeTypes = ['process', 'decision', 'end'];

const EditorToolsSidebar = ({ suggestions = [] }) => {

  const handleDragStart = (event, nodeType, label) => {
    // Always pass JSON with nodeType and label
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ nodeType, label })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="editor-sidebar">
      <h3>Node Toolbox</h3>
      {nodeTypes.map((type) => (
        <div
          key={type}
          className={`sidebar-node sidebar-node-${type}`}
          draggable
          onDragStart={(e) => handleDragStart(e, type, `New ${type}`)}
        >
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
      ))}

      {suggestions.length > 0 && (
        <>
          <h3>AI Suggestions</h3>
          {suggestions.map((sugg, idx) => (
            <div
              key={`sugg-${idx}`}
              className="sidebar-node sidebar-node-suggestion"
              draggable
              onDragStart={(e) => handleDragStart(e, sugg.nodeType, sugg.label)}
              style={{ background: '#fff5d1', cursor: 'grab', margin: 5, padding: 8 }}
            >
              {sugg.label}
            </div>
          ))}
        </>
      )}
    </aside>
  );
};

export default EditorToolsSidebar;
