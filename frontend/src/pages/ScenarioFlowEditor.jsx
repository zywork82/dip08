import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Global.css'; // For general layout and typography
import '../styles/ScenarioFlowEditor.css'; // For specific editor styles

// Mock data for the suggestions section
const suggestions = [
  {
    id: 1,
    text: "Club member spreaded the viral post on his/her social media. How would you deal with this member?",
  },
  {
    id: 2,
    text: "SAO summons you for a talk regarding the viral post. What would you do?",
  },
  {
    id: 3,
    text: "Option A: Attend and tell SAO truthfully what happen, assist them in all ways possible.",
  },
  {
    id: 4,
    text: "Option B: Ignore SAO, take the matter into your own hands",
  },
  {
    id: 5,
    text: "Option C: Don't do anything, just let the post die down",
  },
  {
    id: 6,
    text: "Your club members are worried and constantly chasing you for answers. What would you do?",
  },
];

// Component to display a single suggestion card that is now draggable
const SuggestionCard = ({ suggestion }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify(suggestion));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className="suggestion-card"
      draggable="true"
      onDragStart={handleDragStart}
    >
      <p>{suggestion.text}</p>
    </div>
  );
};

// New ToolCard component to represent a draggable tool
const ToolCard = ({ type, text }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type, text }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className={`tool-card ${type}`}
      draggable="true"
      onDragStart={handleDragStart}
    >
      <p>{text}</p>
    </div>
  );
};

// Component for a draggable and connectable node on the flowchart
const FlowchartNode = ({ id, text, x, y, type, onDragStart, onDragOver, onDrop, onMouseDown }) => {
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
        draggable="true"
        onDragStart={(e) => onDragStart(e, id)}
      ></div>
    </div>
  );
};

const ScenarioFlowEditor = () => {
  const [activeTab, setActiveTab] = useState('tools');
  const [nodes, setNodes] = useState([
    { id: 101, text: "A viral post have been spreading around. You just saw the post what is your first move?", x: 300, y: 50, type: 'scenario' },
    { id: 102, text: "OPTION A: Ignore it and hope it dies down.", x: 100, y: 200, type: 'option' },
    { id: 103, text: "OPTION B: Alert your Exco and call for an emergency meeting.", x: 300, y: 200, type: 'option' },
    { id: 104, text: "OPTION C: Report the post to the platform and request removal.", x: 500, y: 200, type: 'option' },
  ]);
  const [connections, setConnections] = useState([]);
  const [startNodeId, setStartNodeId] = useState(null);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingLine, setConnectingLine] = useState(null);

  // Function to perform an automatic layout of the nodes
  const autoLayoutNodes = () => {
    const arrangedNodes = new Map();
    const childNodesMap = new Map();
    const parentNodes = new Set(nodes.map(n => n.id));

    // Build child map and find root nodes (nodes with no incoming connections)
    connections.forEach(conn => {
      if (!childNodesMap.has(conn.from)) {
        childNodesMap.set(conn.from, []);
      }
      childNodesMap.get(conn.from).push(conn.to);
      parentNodes.delete(conn.to);
    });

    const rootNodes = nodes.filter(n => parentNodes.has(n.id));
    
    let currentY = 50;
    let nodeQueue = [...rootNodes];
    let level = 0;
    const xSpacing = 200; // Minimum horizontal spacing
    const ySpacing = 150; // Vertical spacing

    // Use a queue-based layout (BFS-like) to position nodes
    while (nodeQueue.length > 0) {
      const levelNodes = [];
      const levelSize = nodeQueue.length;
      for (let i = 0; i < levelSize; i++) {
        const currentNode = nodeQueue.shift();
        levelNodes.push(currentNode);
      }
      
      let totalLevelWidth = 0;
      levelNodes.forEach(node => {
          const element = document.getElementById(`node-${node.id}`);
          totalLevelWidth += element ? element.offsetWidth + xSpacing : 0;
      });
      
      let currentX = (window.innerWidth / 2) - (totalLevelWidth / 2);
      
      levelNodes.forEach(currentNode => {
        // Update position only if it's not already positioned
        if (!arrangedNodes.has(currentNode.id)) {
          const element = document.getElementById(`node-${currentNode.id}`);
          const nodeWidth = element ? element.offsetWidth : 150; // Fallback width
          arrangedNodes.set(currentNode.id, {
            ...currentNode,
            x: currentX,
            y: currentY,
          });

          // Add children to the queue for the next level
          const children = childNodesMap.get(currentNode.id) || [];
          const childrenNodes = children.map(childId => nodes.find(n => n.id === childId)).filter(n => n);
          nodeQueue.push(...childrenNodes);
          currentX += nodeWidth + xSpacing;
        }
      });
      currentY += ySpacing;
      level++;
    }

    // Apply the new positions, and keep any nodes that weren't connected at the end
    const finalNodes = nodes.map(node => {
      return arrangedNodes.get(node.id) || node;
    });

    setNodes(finalNodes);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (data) {
      const droppedItem = JSON.parse(data);
      const newId = new Date().getTime();
      
      // Get the position relative to the canvas
      const rect = e.currentTarget.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      const newNode = {
        id: newId,
        text: droppedItem.text,
        x: newX,
        y: newY,
        type: droppedItem.type
      };
      setNodes([...nodes, newNode]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  
  const handleNodeDragStart = (e, nodeId) => {
    e.stopPropagation();
    setStartNodeId(nodeId);
  };

  const handleNodeDragOver = (e) => {
    e.preventDefault();
  };

  const handleNodeDrop = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    if (startNodeId && startNodeId !== targetId) {
      setConnections([...connections, { from: startNodeId, to: targetId }]);
      setStartNodeId(null);
    }
  };
  
  const handleMouseDown = (e, nodeId) => {
    // Check if the click is on a connector. If so, do nothing as the drag logic will handle it.
    if (e.target.className.includes('node-connector')) {
        return;
    }
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDraggedNodeId(nodeId);
      const rect = e.currentTarget.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - node.x,
        y: e.clientY - rect.top - node.y
      });
    }
  };
  
  const handleMouseMove = (e) => {
    // Only move the node if one is being dragged
    if (draggedNodeId !== null) {
      const newNodes = nodes.map(node => {
        if (node.id === draggedNodeId) {
          const rect = e.currentTarget.getBoundingClientRect();
          return {
            ...node,
            x: e.clientX - rect.left - dragOffset.x,
            y: e.clientY - rect.top - dragOffset.y
          };
        }
        return node;
      });
      setNodes(newNodes);
    }
    
    // Only show connecting line if a connection drag has started
    if (startNodeId) {
        const editorRect = e.currentTarget.getBoundingClientRect();
        const startNode = nodes.find(n => n.id === startNodeId);
        if (startNode) {
            const element = document.getElementById(`node-${startNodeId}`);
            if (element) {
                const connectorOut = element.querySelector('.node-connector.out');
                const outRect = connectorOut.getBoundingClientRect();
                const startX = outRect.left + outRect.width / 2 - editorRect.left;
                const startY = outRect.top + outRect.height / 2 - editorRect.top;
                
                const endX = e.clientX - editorRect.left;
                const endY = e.clientY - editorRect.top;
                setConnectingLine({ startX, startY, endX, endY });
            }
        }
    }
  };
  
  const handleMouseUp = (e) => {
    setDraggedNodeId(null);
    setDragOffset({ x: 0, y: 0 });
    setStartNodeId(null); // Reset the start node ID to prevent accidental connections
    setConnectingLine(null);
  };

  const getNodePosition = (id) => {
    const node = nodes.find(n => n.id === id);
    if (node) {
      const element = document.getElementById(`node-${id}`);
      if (!element) return { x: 0, y: 0 };
      const rect = element.getBoundingClientRect();
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
    <div className="flow-editor-page-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="menu-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <span className="sidebar-title">Scenario Flow Editor</span>
          <button className="edit-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
        </div>
        <div className="sidebar-tabs">
          <button 
            className={`tab ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            Tools
          </button>
          <button 
            className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            Suggestions
          </button>
        </div>
        <div className="sidebar-content">
          {activeTab === 'tools' ? (
            <div className="tools-grid">
              <ToolCard type="scenario" text="Scenario" />
              <ToolCard type="option" text="Option" />
              <ToolCard type="popup" text="Pop-up" />
              <ToolCard type="ending" text="Ending" />
            </div>
          ) : (
            <div className="suggestions-list">
              <h3 className="section-heading">Possible Scenarios</h3>
              {suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div 
        className="main-editor-area"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
            <button className="action-button" onClick={autoLayoutNodes}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5l9 5.5 9-5.5"></path>
                <path d="M3 14.5l9 5.5 9-5.5"></path>
                <path d="M3 19.5l9 5.5 9-5.5"></path>
              </svg>
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
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {nodes.map((node) => (
              <FlowchartNode 
                key={node.id} 
                id={node.id}
                text={node.text}
                x={node.x}
                y={node.y}
                type={node.type}
                onDragStart={handleNodeDragStart}
                onDragOver={handleNodeDragOver}
                onDrop={handleNodeDrop}
                onMouseDown={handleMouseDown}
              />
            ))}
          </div>
        </div>
        <div className="editor-footer">
          <button className="editor-button save-button">Save changes</button>
          <button className="editor-button generate-button">Generate Simulation</button>
        </div>
      </div>
    </div>
  );
};

export default ScenarioFlowEditor;
