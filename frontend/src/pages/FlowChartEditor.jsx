import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import SharedHeader from '../components/SharedHeader';
import NavigationBar from '../components/SlimNavBar';
import { sampleNodes, sampleAiSuggestions, sampleEdges } from '../data/sampleAiFlow';

// Placeholder for the profile image
const profileImage = 'https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg';

// Node types
const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  ending: NodeWrapper,
};

// Dagre layout setup
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 200;
const nodeHeight = 150;

const getLayoutedNodes = (nodes, edges) => {
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 150, nodesep: 100 });
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

// Generate edges from node data
const generateEdgesFromNodes = (nodes) => {
  const edges = [];
  nodes.forEach((node) => {
    const data = node.data || {};
    if (node.type === 'scenario' && data.options?.length) {
      data.options.forEach((optId) => {
        if (nodes.find((n) => n.id === optId)) {
          edges.push({
            id: `e-${node.id}-${optId}`,
            source: node.id,
            target: optId,
            type: 'smoothstep',
            animated: true,
          });
        }
      });
    }
    if (node.type === 'option' && data.next) {
      if (nodes.find((n) => n.id === data.next)) {
        edges.push({
          id: `e-${node.id}-${data.next}`,
          source: node.id,
          target: data.next,
          type: 'smoothstep',
          animated: true,
        });
      }
    }
  });
  return edges;
};

const FlowChartEditor = () => {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const backendFlow = location.state?.flowData;

  // === Node label editing ===
  const handleNodeLabelChange = (id, value) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, label: value } } : node))
    );
  };

  // === Node deletion ===
  const removeNode = (nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  // === React Flow handlers ===
  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', animated: true }, eds)),
    []
  );
  const onEdgeUpdate = useCallback((oldEdge, newConnection) => {
    setEdges((els) => els.map((e) => (e.id === oldEdge.id ? { ...e, ...newConnection } : e)));
  }, []);
  const onEdgeClick = useCallback((event, edge) => {
    event.preventDefault();
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, []);

  // === Layout & persistence ===
  const autoLayout = () => setNodes((nds) => getLayoutedNodes(nds, edges));
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

  // === Node dropping ===
  const handleDrop = (event) => {
    event.preventDefault();
    if (!reactFlowInstance || !reactFlowWrapper.current) return;

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('application/reactflow'));
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
        options: data.options || [],
        next: data.next || null,
        onChange: (e) => handleNodeLabelChange(id, e.target.value),
        onDelete: () => removeNode(id),
      },
    };

    // Add new node
    let updatedNodes = [...nodes, newNode];

    // Auto-link to last node
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      if (lastNode.type === 'scenario') {
        lastNode.data = { ...lastNode.data, options: [...(lastNode.data.options || []), newNode.id] };
      } else if (lastNode.type === 'option') {
        lastNode.data = { ...lastNode.data, next: newNode.id };
      }
      updatedNodes = [...nodes.slice(0, -1), lastNode, newNode];
    }

    // Generate edges only for the new node
    const newEdgesFromNode = generateEdgesFromNodes(updatedNodes).filter(
      (e) => !edges.find((edge) => edge.id === e.id)
    );

    setNodes(updatedNodes);
    setEdges([...edges, ...newEdgesFromNode]);
  };

  // === Node data mapping ===
  const nodesWithHandlers = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onChange: (e) => handleNodeLabelChange(node.id, e.target.value),
      onDelete: () => removeNode(node.id),
    },
  }));

  // === Preview ===
  const openPreview = () => {
    if (!reactFlowInstance) return;
    const flowData = reactFlowInstance.toObject();
    const layoutedNodes = getLayoutedNodes(flowData.nodes, flowData.edges);
    setPreviewData({
      nodes: layoutedNodes.map((n) => ({ ...n, data: { label: n.data.label, imageUrl: n.data.imageUrl } })),
      edges: flowData.edges,
    });
    setPreviewOpen(true);
  };

  const generateImages = () => {
    if (!previewData) return;
    const updatedFlow = {
      nodes: previewData.nodes.map((n) => ({
        ...n,
        data: { ...n.data, imageUrl: 'https://via.placeholder.com/150' },
      })),
      edges: previewData.edges,
    };
    setPreviewOpen(false);
    navigate('/scene-editor', { state: { flowData: updatedFlow } });
  };

  // === Initial load ===
  useEffect(() => {
    if (backendFlow) {
      setNodes(getLayoutedNodes(backendFlow.nodes, backendFlow.edges));
      setEdges(backendFlow.edges || generateEdgesFromNodes(backendFlow.nodes));
    } else {
      const initialNodes = Object.values(sampleNodes).map((n) => ({ ...n }));
      const initialEdges = sampleEdges?.length ? sampleEdges : generateEdgesFromNodes(initialNodes);
      setNodes(getLayoutedNodes(initialNodes, initialEdges));
      setEdges(initialEdges);
    }
  }, [backendFlow]);

  return (
    <div className='flow-chart-editor-container'>
      <NavigationBar />
      <div className="editor-container">
        <div className="header">
          <SharedHeader profileImage={profileImage} userName="Prof Andy" userRole="Administrator" />
        </div>

        <div className="edit-container">
          <div className="tools-sidebar">
            <EditorToolsSidebar suggestions={sampleAiSuggestions} />
          </div>

          <div ref={reactFlowWrapper} className='main-editor-area'>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodesWithHandlers}
                edges={edges}
                nodeTypes={nodeTypesConfig}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onEdgeUpdate={onEdgeUpdate}
                onEdgeClick={onEdgeClick}
                onConnect={onConnect}
                fitView
                onInit={setReactFlowInstance}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                defaultEdgeOptions={{ animated: true, type: 'smoothstep', updatable: true }}
                deleteKeyCode={[46, 8]}
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            </ReactFlowProvider>

            {/* Buttons */}
            <div className="button-container" >
              <button className='action-buttons' onClick={autoLayout}>Auto Layout</button>
              <button className='action-buttons' onClick={saveFlow}>Save Flow</button>
              <button className='action-buttons' onClick={loadFlow}>Load Flow</button>
              <button className='action-buttons' onClick={openPreview}>Preview</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowChartEditor;
