
// FlowChartEditor.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MiniMap,
  Controls,
  Background,
} from 'reactflow';
import dagre from 'dagre';
import EditorToolsSidebar from '../components/EditorToolsSidebar';
import NodeWrapper from '../components/NodeWrapper';
import 'reactflow/dist/style.css';
import '../styles/FlowChartEditor.css';
import { sampleNodes, sampleEdges, sampleAiSuggestions } from '../data/sampleAiFlow';

const nodeTypesConfig = {
  process: NodeWrapper,
  decision: NodeWrapper,
  end: NodeWrapper,
};


// Dagre layout
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 200;
const nodeHeight = 50;

const getLayoutedNodes = (nodes, edges) => {
  if (!nodes || nodes.length === 0) return nodes;

  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 150 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));

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

const FlowChartEditor = () => {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
const [nodes, setNodes] = useState([]); // must define!
const [edges, setEdges] = useState([]);

  const [previewData, setPreviewData] = useState(null); // for modal preview
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const onConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge({ ...connection, type: 'smoothstep', animated: true, deletable: true, selectable: true }, eds)
      ),
    []
  );

  const onEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      setEdges((els) => els.map((e) => (e.id === oldEdge.id ? { ...e, ...newConnection } : e)));
    },
    []
  );

  const onEdgeClick = useCallback((event, edge) => {
    event.preventDefault();
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, []);

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
        onDelete: () => removeNode(id),
      },
    };

    setNodes((nds) => nds.concat(newNode));
  };

  // Nodes with handlers
  const nodesWithHandlers = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onChange: (e) => handleNodeLabelChange(node.id, e.target.value),
      onDelete: () => removeNode(node.id),
    },
  }));

  // Open modal preview
const openPreview = () => {
  if (!reactFlowInstance) return;

  const flowData = reactFlowInstance.toObject();

  // Apply auto layout for preview
  const layoutedNodes = getLayoutedNodes(flowData.nodes, flowData.edges);

  const serializableFlow = {
    nodes: layoutedNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: n.data.label },
    })),
    edges: flowData.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
    })),
  };

  setPreviewData(serializableFlow);
  setPreviewOpen(true);
};

  // Send to backend
  const generateImages = () => {
  if (!previewData) return;

  // Simulate backend call
  setTimeout(() => {
    // Create mock nodes with image URLs
    const updatedFlow = {
      nodes: previewData.nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          imageUrl: 'https://via.placeholder.com/150', // placeholder image
        },
      })),
      edges: previewData.edges,
    };

    setPreviewOpen(false);
    navigate('/scene-editor', { state: { flowData: updatedFlow } });
  }, 1000); // simulate 1-second network delay
};

  const navigate = useNavigate();

  const previewFlow = () => {
  const flowData = reactFlowInstance.toObject();
  const serializableFlow = {
    nodes: flowData.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: { label: n.data.label } })),
    edges: flowData.edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type })),
  };

  navigate('/preview', { state: { flowData: serializableFlow } });
};
useEffect(() => {
  // Only fetch if reactFlowInstance is ready
  const fetchFlowData = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: "An employee clicks a phishing email and IT must respond. Management faces tough choices.",
          levels: [3, 3, 3, 3],
        }),
      });

      if (!res.ok) throw new Error('Backend error');

      const data = await res.json();

      // Transform backend data into React Flow format
      const nodes = data.nodes.map((n, idx) => ({
        id: n.id,
        type: n.type,
        position: { x: idx * 200, y: idx * 120 }, // temporary; dagre will auto-layout
        data: { 
          label: n.text,
          narrative: n.narrative,
          scene: n.scene,
          imageUrl: n.image || null,
          onChange: (e) => handleNodeLabelChange(n.id, e.target.value),
          onDelete: () => removeNode(n.id)
        },
      }));

      const edges = data.edges.map((e, idx) => ({
        id: `e-${idx}`,
        source: e.from,
        target: e.to,
        label: e.label || '',
      }));

      setNodes(nodes);
      setEdges(edges);

      // Optional: auto layout
      setNodes((nds) => getLayoutedNodes(nds, edges));

    } catch (err) {
      console.error('Failed to fetch flow data:', err);
    }
  };

  fetchFlowData();
}, []);
  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh' }}>
      <EditorToolsSidebar suggestions={sampleAiSuggestions} />

      <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeUpdate={onEdgeUpdate}
            onEdgeClick={onEdgeClick}
            onConnect={onConnect}
            nodeTypes={nodeTypesConfig}
            fitView
            onInit={setReactFlowInstance}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            defaultEdgeOptions={{
              animated: true,
              type: 'smoothstep',
              updatable: true,
              deletable: true,
              selectable: true,
            }}
            deleteKeyCode={[46, 8]}
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>

          <div style={{ position: 'absolute', left: 730, bottom: 60, display: 'flex', gap: 10 }}>
            <button onClick={autoLayout}>Auto Layout</button>
            <button onClick={saveFlow}>Save Flow</button>
            <button onClick={loadFlow}>Load Flow</button>
            <button onClick={openPreview}>Preview</button>
          </div>

          {/* Modal Preview */}
          {previewOpen && (
            <div className='preview-container'
              style={{
                position: 'fixed',
                top: 50,
                left: 50,
                width: '80%',
                height: '80%',
                background: 'white',
                border: '1px solid #ccc',
                boxShadow: '0 0 15px rgba(0,0,0,0.3)',
                zIndex: 1000,
                padding: 20,
                
              }}
            >
             <div>
              <p className='preview-title'>Preview</p>
             </div>

              <ReactFlowProvider>
                <ReactFlow
                  nodes={previewData?.nodes}
                  edges={previewData?.edges}
                  nodeTypes={nodeTypesConfig}
                  fitView
                  defaultEdgeOptions={{ animated: true, type: 'smoothstep' }}
                     panOnDrag={true}           // allow scrolling/panning
      zoomOnScroll={true}        // allow zoom with scroll wheel
      zoomOnPinch={true}    
                  nodesDraggable={false}
                >
                  <MiniMap />
                  <Controls />
                </ReactFlow>
              </ReactFlowProvider>
          <div className='preview-buttons'> 
            <button
                onClick={() => setPreviewOpen(false)}
              >
                Close Preview
              </button>
              <button
                onClick={generateImages}
                
              >
                Generate Images
              </button>
              </div>
            </div>
          )}
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default FlowChartEditor;
