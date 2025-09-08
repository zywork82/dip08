// ScenarioFlowEditor.jsx
import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position
} from 'reactflow';
import dagre from 'dagre';
import EditorToolsSidebar from '../components/EditorToolsSidebar';
import 'reactflow/dist/style.css';
import '../styles/ScenarioFlowEditor.css';
import { sampleNodes, sampleEdges, sampleAiSuggestions } from '../data/sampleAiFlow';

// Node types with delete button
const NodeWrapper = ({ data, id, selected ,type}) => (
  <div className={`node node-${type}`}>
    <Handle type="target" position={Position.Top} />
    <input
      value={data.label}
      onChange={data.onChange}
      style={{ width: '100%', border: 'none', background: 'transparent' }}
    />
    <Handle type="source" position={Position.Bottom} />

    {selected && (
      <button className='node-delete-button'
        onClick={data.onDelete}
        
      >
        ×
      </button>
    )}
  </div>
);

const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  popup: NodeWrapper,
  ending: NodeWrapper
};

// Dagre layout setup
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 200;
const nodeHeight = 50;

const getLayoutedNodes = (nodes, edges) => {
  if (!nodes || nodes.length === 0) return nodes;

  dagreGraph.setGraph({ rankdir: 'TB' });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
  
  // Only add edges that have both source and target nodes existing
  edges.forEach((edge) => {
    const sourceExists = nodes.some((n) => n.id === edge.source);
    const targetExists = nodes.some((n) => n.id === edge.target);
    if (sourceExists && targetExists) dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const layoutNode = dagreGraph.node(node.id);
    return layoutNode
      ? { ...node, position: { x: layoutNode.x - nodeWidth / 2, y: layoutNode.y - nodeHeight / 2 } }
      : node;
  });
};

const ScenarioFlowEditor = () => {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const [nodes, setNodes] = useState(sampleNodes);
  const [edges, setEdges] = useState(sampleEdges);

  // Editable node labels
  const handleNodeLabelChange = (id, value) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: value, onChange: (e) => handleNodeLabelChange(id, e.target.value) } }
          : node
      )
    );
  };

  // Delete node and connected edges
  const removeNode = (nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  // Node & edge handlers
  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((connection) => setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', animated: true }, eds)), []);

  // Auto layout
  const autoLayout = () => setNodes((nds) => getLayoutedNodes(nds, edges));

  // Save / Load
  const saveFlow = () => {
    localStorage.setItem('flowData', JSON.stringify({ nodes, edges }));
    alert('Flow saved!');
  };
  const loadFlow = () => {
    const data = JSON.parse(localStorage.getItem('flowData'));
    if (data) {
      setNodes(data.nodes);
      setEdges(data.edges);
      alert('Flow loaded!');
    }
  };

  // Drop handler
  const handleDrop = (event) => {
    event.preventDefault();
    if (!reactFlowInstance || !reactFlowWrapper.current) return;

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    let data;

    try {
      const dataString = event.dataTransfer.getData('application/reactflow');
      if (!dataString) return;
      data = JSON.parse(dataString);
    } catch {
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;
      data = { nodeType: type, label: `New ${type}` };
    }

    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const id = `${data.nodeType}_${+new Date()}`;
    const newNode = {
      id,
      type: data.nodeType,
      position,
      data: {
        label: data.label || `New ${data.nodeType}`,
        onChange: (e) => handleNodeLabelChange(id, e.target.value),
        onDelete: () => removeNode(id)
      },
    };

    setNodes((nds) => nds.concat(newNode));
  };

  // Inject handlers
  const nodesWithHandlers = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onChange: (e) => handleNodeLabelChange(node.id, e.target.value),
      onDelete: () => removeNode(node.id)
    }
  }));

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh' }}>
      <EditorToolsSidebar suggestions={sampleAiSuggestions} />

      <div style={{ flex: 1 }} ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypesConfig}
            fitView
            onInit={setReactFlowInstance}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            defaultEdgeOptions={{ animated: true, type: 'smoothstep' }}
            deleteKeyCode={46} // Delete key
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
          <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', gap: 10 }}>
            <button onClick={autoLayout}>Auto Layout</button>
            <button onClick={saveFlow}>Save Flow</button>
            <button onClick={loadFlow}>Load Flow</button>
          </div>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default ScenarioFlowEditor;
