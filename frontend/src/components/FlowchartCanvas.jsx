import React from 'react';
import FlowchartNode from './FlowchartNode';

const FlowchartCanvas = ({ 
  nodes, 
  connections, 
  connectingLine, 
  onDragOver, 
  onDrop, 
  onMouseMove, 
  onMouseUp, 
  onNodeDragStart, 
  onNodeDragOver, 
  onNodeDrop, 
  onMouseDown,
    onSave,          // NEW
  onLoad
}) => {

  const getNodePosition = (id) => {
    const node = nodes.find(n => n.id === id);
    if (node) {
      const element = document.getElementById(`node-${id}`);
      if (!element) return { x: 0, y: 0 };
      const editorRect = document.querySelector('.main-editor-area').getBoundingClientRect();
      const connectorOut = element.querySelector('.node-connector.out');
      const connectorIn = element.querySelector('.node-connector.in');
      
      const editorScrollTop = document.querySelector('.flowchart-container').scrollTop;
      const editorScrollLeft = document.querySelector('.flowchart-container').scrollLeft;
      
      const outPos = connectorOut.getBoundingClientRect();
      const inPos = connectorIn.getBoundingClientRect();

      return {
        out: {
          x: outPos.left + outPos.width / 2 - editorRect.left + editorScrollLeft,
          y: outPos.top + outPos.height / 2 - editorRect.top + editorScrollTop,
        },
        in: {
          x: inPos.left + inPos.width / 2 - editorRect.left + editorScrollLeft,
          y: inPos.top + inPos.height / 2 - editorRect.top + editorScrollTop,
        }
      };
    }
    return { x: 0, y: 0 };
  };

  return (
    <div 
      className="main-editor-area"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <div className="editor-header">
        <div className="plan-tabs">
          <button className="plan-tab active">Plan 1</button>
          <button className="plan-tab">Plan 2</button>
          <button className="add-plan-button">+</button>
        </div>
        <div className="editor-title-container">
          <h1 className="editor-title">Viral Post Handling</h1>
          <div className="title-underline"></div>
        </div>
        <div className="editor-actions">
          <button className="action-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
          <button className="action-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2z"></path>
              <path d="M5 19V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"></path>
            </svg>
          </button>
          <button className="action-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
          <button className="action-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
          <button className="action-button" onClick={() => {}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5l9 5.5 9-5.5"></path>
              <path d="M3 14.5l9 5.5 9-5.5"></path>
              <path d="M3 19.5l9 5.5 9-5.5"></path>
            </svg>
          </button>
          <button className="editor-button" onClick={onSave}>
    Save JSON
  </button>
  <button className="editor-button" onClick={onLoad}>
    Load JSON
  </button>
        </div>
      </div>
      <div 
        className="canvas-area"
      >
        <svg className="connections-svg">
          {connections.map((conn, index) => {
            const fromPos = getNodePosition(conn.from).out;
            const toPos = getNodePosition(conn.to).in;
            return (
              <line
                key={index}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#3f51b5"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
           {connectingLine && (
              <line
                x1={connectingLine.startX}
                y1={connectingLine.startY}
                x2={connectingLine.endX}
                y2={connectingLine.endY}
                stroke="#9CA3AF"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
          )}
           <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#3f51b5" />
            </marker>
          </defs>
        </svg>
        <div 
          className="flowchart-container"
        >
          {nodes.map((node) => (
            <FlowchartNode 
              key={node.id} 
              id={node.id}
              text={node.text}
              x={node.x}
              y={node.y}
              type={node.type}
              onDragStart={onNodeDragStart}
              onDragOver={onNodeDragOver}
              onDrop={onNodeDrop}
              onMouseDown={onMouseDown}
                onSave={handleSave}      
  onLoad={handleLoad}  
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlowchartCanvas;
