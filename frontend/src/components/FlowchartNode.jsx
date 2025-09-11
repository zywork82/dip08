import React from 'react';

const FlowchartNode = ({ id, text, x, y, type, onDragOver, onDrop, onMouseDown, onConnectionStart }) => {
  return (
    <div
      id={`node-${id}`}
      className={`flowchart-node ${type || ''}`}
      style={{ left: `${x}px`, top: `${y}px` }}
      onMouseDown={(e) => onMouseDown(e, id)}
      contentEditable="true"
    >
      <div 
        className="node-connector in" 
        onDragOver={onDragOver} 
        onDrop={(e) => onDrop(e, id)}
      ></div>
      {text}
      <div 
        className="node-connector out"
        onMouseDown={(e) => {
          e.stopPropagation(); // Prevents node dragging when clicking on connector
          onConnectionStart(id);
        }}
      ></div>
    </div>
  );
};

export default FlowchartNode;
