import React from 'react';
import '../styles/EditorToolsSidebar.css';

const nodeTypes = ['scenario', 'option', 'ending'];

const EditorToolsSidebar = ({ scenarioTitle = '',setScenarioTitle = () => {}, suggestions = [] }) => {

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
    <div className="scenario-title">
      <span className='scenario-title-heading'>Scenario Title</span>
      <input
        className='scenario-title-input'
        type="text"
        value={scenarioTitle}
        onChange={(e) => setScenarioTitle(e.target.value)}
        placeholder="Enter Scenario Title"
      />
    </div>
     <div className="node-toolbox-container">
      {/* Node Toolbox */}
      <span className='scenario-title-heading'>Node Toolbox</span>
      {nodeTypes.map((type) => (
        <div
          key={type}
          className={`sidebar-node sidebar-node-${type} node-type-${type}`}
          draggable
          onDragStart={(e) => handleDragStart(e, type, `New ${type}`)}
        >
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
      ))}
      </div>
      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <>
          <div className='suggestion-header'>
             <span className='scenario-title-heading'>AI Suggestions</span>
            <button className='ai-suggestion-button' onClick={() => {}}>Generate</button>
          </div>
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
