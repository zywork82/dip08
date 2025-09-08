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

// Node types
const nodeTypesConfig = {
  scenario: ({ data }) => (
    <div style={{
      padding: 10,
      backgroundColor: '#d1fae5',
      border: '2px solid #10b981',
      borderRadius: 5,
      minWidth: 200
    }}>
      <Handle type="target" position={Position.Top} />
      <input
        value={data.label}
        onChange={data.onChange}
        style={{ width: '100%', border: 'none', background: 'transparent' }}
      />
      <Handle type="source" position={Position.Bottom} />
    </div>
  ),
  option: ({ data }) => (
    <div style={{
      padding: 10,
      backgroundColor: '#e0e7ff',
      border: '2px solid #6366f1',
      borderRadius: 5,
      minWidth: 200
    }}>
      <Handle type="target" position={Position.Top} />
      <input
        value={data.label}
        onChange={data.onChange}
        style={{ width: '100%', border: 'none', background: 'transparent' }}
      />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
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
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
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

  // Nodes and edges state
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

  // Drop handler (merged for tools & AI suggestions)
  const handleDrop = (event) => {
  event.preventDefault();
  if (!reactFlowInstance || !reactFlowWrapper.current) return;

  const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();

  let data;
  try {
    // Parse JSON from sidebar drag (AI suggestions or tools)
    const dataString = event.dataTransfer.getData('application/reactflow');
    if (!dataString) return;
    data = JSON.parse(dataString);
  } catch {
    // Fallback: just a string type from legacy tools
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
      label: data.label || `New ${data.nodeType}`, // ensure text exists
      onChange: (e) => handleNodeLabelChange(id, e.target.value),
    },
  };

  setNodes((nds) => nds.concat(newNode));
};

  // Inject onChange into nodes
  const nodesWithHandlers = nodes.map((node) => ({
    ...node,
    data: { ...node.data, onChange: (e) => handleNodeLabelChange(node.id, e.target.value) }
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
