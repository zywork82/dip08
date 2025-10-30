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
import { convertBackendToFrontend, convertFrontendToBackend } from "../utils/flowConverter";

// Placeholder profile image
const profileImage = 'https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A';

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

// Generate edges based on node options/next
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

// Standardize node data
const standardizeNodeData = (node) => {
  const dataFromBackend = typeof node.data === 'object' ? node.data : { label: node.data || '' };
  return {
    ...node,
    data: {
      ...dataFromBackend,
      options: node.options || dataFromBackend.options || [],
      next: node.next || dataFromBackend.next || null,
      scene: node.scene || dataFromBackend.scene || '',
      b64image: node.b64image || dataFromBackend.b64image || '',
      onChange: () => {},
      onDelete: () => {},
    },
  };
};


const FlowChartEditor = () => {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const backendFlow = location.state?.flowData;
  const [scenarioTitle, setScenarioTitle] = useState(location.state?.scenarioTitle || "Untitled Scenario");
  // === Node label editing ===
  const handleNodeLabelChange = (id, e) => {
  const value = e.target.value;
  setNodes((nds) =>
    nds.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, label: value } }
        : node
    )
  );
};


  // === Node deletion ===
  const removeNode = (nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  // === React Flow handlers ===
   const onNodesChange = useCallback((changes) => {

  setNodes((nds) =>

    applyNodeChanges(changes, nds).map((node) => ({

      ...node,

      data: {

        ...nds.find(n => n.id === node.id)?.data, // preserve options/next

      },

    }))

  );

}, []);
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

  // === Auto Layout ===
  const autoLayout = () => setNodes((nds) => getLayoutedNodes(nds, edges));

  // === Save Flow locally ===
  const saveFlow = () => {
    localStorage.setItem('flowData', JSON.stringify({ nodes, edges }));
    alert('Flow saved locally!');
  };

  // === Node drop ===
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
    const newNode = standardizeNodeData({
      id,
      type: data.nodeType,
      position,
      data: {
        label: data.label || `New ${data.nodeType}`,
        options: [],
        next: null,
        scene: '',
        b64image: '',
      },
    });

    setNodes((nds) => [...nds, newNode]);
  };

  // === Nodes with handlers ===
 const nodesWithHandlers = nodes.map((node) => ({
  ...node,
  data: {
    ...node.data,
    onChange: (e) => handleNodeLabelChange(node.id, e),
    onDelete: () => removeNode(node.id),
    options: node.data?.options || [],
    next: node.data?.next || null,
  },
}));


  // === Generate images / proceed to scene editor ===
const generateImages = async () => {
  if (!reactFlowInstance) return;

  try {
    // Step 1: Collect nodes info for backend
    const flowData = reactFlowInstance.toObject();
    const layoutedNodes = getLayoutedNodes(flowData.nodes, flowData.edges);

    const nodesForApi = layoutedNodes.map((n) => ({
      id: n.id,
      data_description:
        typeof n.data === "object"
          ? n.data.label || n.data.scene || ""
          : n.data || "",
    }));

    // Step 2: Send to Flask backend to generate images
    const res = await fetch("http://127.0.0.1:5000/generate_images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmp: true, // optional flag; backend will accept this
        nodes: nodesForApi,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.images?.length) throw new Error("No images returned");

    // Step 3: Merge returned image data back into nodes
const newNodes = layoutedNodes.map((n) => {
  const match = data.images.find((img) => img.id === n.id);
  const imageUrl = match
    ? `data:image/png;base64,${match.image_b64}`
    : n.data?.b64image || "";
  return {
    ...n,
    data: {
      ...(typeof n.data === "object" ? n.data : { label: n.data }),
      imageUrl,
      // remove functions to avoid DataCloneError
      onChange: undefined,
      onDelete: undefined,
    },
  };
});

// Step 4: Navigate to Scene Editor with sanitized data
navigate("/scene-editor", {
  state: {
    flowData: { nodes: newNodes, edges: flowData.edges },
  },
});

  } catch (err) {
    console.error("Error generating images:", err);
    alert("⚠️ Failed to generate images — check console for details.");
  }
};




// === Initial load (with ResizeObserver-safe fitView) ===
useEffect(() => {
  if (!reactFlowInstance) return;

  if (backendFlow) {
    console.log("AI backendFlow nodes:", backendFlow.nodes);
    backendFlow.nodes.forEach(node => {
  if (node.type === 'scenario' && (!node.data.options || !node.data.options.length)) {
    console.warn(`Scenario node ${node.id} has no options`);
  }
  if (node.type === 'option' && !node.data.next) {
    console.warn(`Option node ${node.id} has no next node`);
  }
});
    const standardizedNodes = backendFlow.nodes.map(standardizeNodeData);
    setNodes(getLayoutedNodes(standardizedNodes, backendFlow.edges));
    setEdges(backendFlow.edges || generateEdgesFromNodes(standardizedNodes));
  } else {
    const initialNodes = Object.values(sampleNodes).map(standardizeNodeData);
    const initialEdges = sampleEdges?.length ? sampleEdges : generateEdgesFromNodes(initialNodes);
    setNodes(getLayoutedNodes(initialNodes, initialEdges));
    setEdges(initialEdges);
  }

  const timeout = setTimeout(() => reactFlowInstance.fitView(), 100);
  return () => clearTimeout(timeout);
}, [reactFlowInstance, backendFlow]);



useEffect(() => {
  setEdges((eds) => {
    const newEdges = generateEdgesFromNodes(nodes);
    // keep edges that already exist
    const existingEdges = eds.filter(
      (e) => !newEdges.find((ne) => ne.id === e.id)
    );
    return [...existingEdges, ...newEdges];
  });
}, [nodes]);

  // === Backend save ===
const handleSave = async () => {
  if (!scenarioTitle) return alert("Please enter a scenario title!");
  if (!nodes.length) return alert("No nodes to save!");

  // Prepare nodes in backend format
  const sanitizedNodes = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data?.label || n.data?.text || "",      // backend 'data'
    description: n.data?.label ? n.data.label : (n.data?.text || ""), // cleaned-up short desc
    options: n.data?.options || [],
    psych_dimensions: n.data?.psych_dimensions || "", // optional, can leave empty
    position: "", // frontend position not needed
  }));

  const nodesForBackend = nodes.map((node) => {
  const children = edges
    .filter((e) => e.source === node.id)
    .map((e) => e.target);

  return {
    id: node.id,
    type: node.type,
    data: node.data?.label || node.data?.text || "",
    description: node.data?.label || node.data?.text || "",
     options: children.length ? children : (node.data?.options || []), // fallback to original options
    psych_dimensions: node.data?.psych_dimensions || "",
    position: node.position || "",
  };
});

const flowData = {
  title: scenarioTitle,
  nodes: nodesForBackend,
  edges, // optional if backend still uses edges
  startNodeId: nodes[0]?.id || null,
};


  try {
    const res = await fetch("http://127.0.0.1:5000/scenarios/saveFlow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flowData),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    alert(data.success ? `Saved scenario "${scenarioTitle}" successfully!` : "Failed to save scenario");
  } catch (err) {
    console.error(err);
    alert("Error connecting to backend: " + err.message);
  }
};

  return (
    <div className='flow-chart-editor-container'>
      <NavigationBar />
      <div className="editor-container">
        <div className="header">
          <SharedHeader profileImage={profileImage} userName="Prof Andy" userRole="Administrator" />
        </div>

        <div className="edit-container">
          <div className="tools-sidebar">
            <EditorToolsSidebar 
              scenarioTitle={scenarioTitle} 
              setScenarioTitle={setScenarioTitle}
              suggestions={sampleAiSuggestions} 
            />
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

              <div className="button-container">
                <button className='action-buttons' onClick={autoLayout}>Auto Layout</button>
                <button className='action-buttons' onClick={() => { saveFlow(); handleSave(); }}>Save Flow</button>
                <button className='action-buttons' onClick={generateImages}>Generate Images</button>
              </div>
            </ReactFlowProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowChartEditor;
