import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactFlow, {
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
} from "reactflow";
import NodeWrapper from "../components/NodeWrapper";
import "reactflow/dist/style.css";
import "../styles/SceneEditor.css";
import SharedHeader from "../components/SharedHeader";
import NavigationBar from "../components/SlimNavBar";
import dagre from "dagre";
import { convertBackendToFrontend } from "../utils/flowConverter";
import { convertFrontendToBackend } from "../utils/flowConverter";

// 🧩 Node types
const nodeTypesConfig = {
  process: NodeWrapper,
  decision: NodeWrapper,
  end: NodeWrapper,
  scenario: NodeWrapper,
  option: NodeWrapper,
  ending: NodeWrapper,
  endScenario: NodeWrapper, // Added for completeness if present in flow
};

// 🧩 Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 200;
const nodeHeight = 150;

/**
 * Standardizes the node data from { data: "string" } to React Flow format { data: { label: "string", ... } }.
 * This is essential because sampleAiFlow uses a string for the main 'data' property.
 * @param {object} node - The raw node object from the data source.
 * @returns {object} The standardized node object for React Flow state.
 */
const standardizeNodeData = (node) => {
  // Determine the label: use the string 'data' if present, otherwise use existing 'data.label'
  const label = (typeof node.data === "string" ? node.data : node.data?.label) || "";

  // Combine all properties into the standardized 'data' object
  const standardizedData = {
    label: label,
    // Map other properties that may be at the root or within data
    options: node.options || node.data?.options || [],
    next: node.next || node.data?.next || null,
    scene: node.scene || node.data?.scene || "",
    b64image: node.b64image || node.data?.b64image || "",
    generatedImages: node.data?.generatedImages || [],
    imageUrl: node.data?.imageUrl || null,
    // Spread any other data properties if 'node.data' was already an object
    ...(typeof node.data === "object" ? node.data : {}),
  };
  
  return {
    // Return the original node object spread, but override the 'data' property
    ...node,
    data: standardizedData,
  };
};

const getLayoutedNodes = (nodes, edges) => {
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 250, nodesep: 300 });
  nodes.forEach((node) =>
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  );
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  return nodes.map((node) => {
    const layoutNode = dagreGraph.node(node.id);
    return layoutNode
      ? {
          ...node,
          position: {
            x: layoutNode.x - nodeWidth / 2,
            y: layoutNode.y - nodeHeight / 2,
          },
        }
      : node;
  });
};

const SceneEditor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const passedFlow = location.state?.flowData;

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [promptText, setPromptText] = useState("");

  // 🧠 Mock image generation (remains unchanged)
  const mockGenerateImages = (nodeId, prompt) =>
    new Promise((resolve) => {
      setTimeout(() => {
        const images = Array.from({ length: 3 }, () =>
          `https://picsum.photos/200/150?random=${Math.floor(
            Math.random() * 1000
          )}`
        );
        resolve({ images });
      }, 400);
    });

  // 🔄 Re-generate node images (remains unchanged)
  const handleReprompt = (nodeId, prompt) => {
    mockGenerateImages(nodeId, prompt).then((data) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  generatedImages: data.images,
                  imageUrl: data.images[0],
                },
              }
            : n
        )
      );
    });
  };

  // 🖼️ Select which image to use (remains unchanged)
const selectImageForNode = (nodeId, imgUrl) => {
  setNodes((nds) =>
    nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, imageUrl: imgUrl } }
        : n
    )
  );
};


  // 🧠 Auto-generate images for all nodes on load (remains unchanged)
  const autoGenerateImagesForAll = async (nodesList) => {
    const updatedNodes = await Promise.all(
      nodesList.map(async (node) => {
        if (node.data.generatedImages?.length > 0) return node;
        // Uses standardized data.label as prompt
        const prompt = node.data.label; 
        const data = await mockGenerateImages(node.id, prompt);
        return {
          ...node,
          data: {
            ...node.data,
            generatedImages: data.images,
            imageUrl: data.images[0],
          },
        };
      })
    );
    setNodes(updatedNodes);
  };

  // 🧩 Apply node position or label changes (remains unchanged)
  const onNodesChange = (changes) =>
    setNodes((nds) => applyNodeChanges(changes, nds));

  // 🎯 Handle node click
const onNodeClick = (_, node) => {
  // Access the standardized 'data.label' for the sidebar
  const safeLabel = node.data.label || "";
  setSelectedNode(node);
  setPromptText(safeLabel);
};


  // 🧠 Initialize flow from passed data or latestFlow
  useEffect(() => {
  let flowData = passedFlow || JSON.parse(localStorage.getItem("latestFlow"));
  if (!flowData) return;

  // Handle backend format if necessary
  if (!flowData.nodes) {
    const frontendFlow = convertBackendToFrontend(flowData);
    flowData = {
      nodes: Object.values(frontendFlow),
      edges: [],
    };
  }
  
  // 🔑 APPLY STANDARDIZATION HERE
  // Every node passed in is converted to the React Flow object data format
  const standardizedNodes = flowData.nodes.map(standardizeNodeData);

  // 🧠 Layout and set state
  const layouted = getLayoutedNodes(standardizedNodes, flowData.edges || []);
  setEdges(flowData.edges || []);
  setNodes(layouted);

  // 🧠 Auto-generate images for all nodes (after layout)
  autoGenerateImagesForAll(layouted);
}, [passedFlow]);


  // 💾 Save & Play story + save to history
const handleSaveAndPlay = () => {
  // 1️⃣ Clean nodes for frontend usage (ReactFlow)
  const cleanNodes = nodes.map((n) => ({
    ...n,
    data: {
      // Extract the label from data.label
      label: n.data.label || "Untitled",
      imageUrl: n.data.imageUrl,
      generatedImages: n.data.generatedImages || [],
      options: n.data.options || [],
      next: n.data.next || null,
    },
    // Remove temporary layout and image properties before saving
    position: undefined,
    width: undefined,
    height: undefined,
  }));

const flowToPlayFrontend = {
  startNodeId: cleanNodes[0].id,
  nodes: cleanNodes,
  edges,
};


  // 2️⃣ Convert frontend ReactFlow structure → backend format
  // The 'convertFrontendToBackend' utility must handle mapping the { label: '...' } back to the string 'data'
  const flowToSaveBackend = convertFrontendToBackend(
    cleanNodes.reduce((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {})
  );

  // 3️⃣ Save latest flow in backend format
  localStorage.setItem("latestFlow", JSON.stringify(flowToSaveBackend));

  // 4️⃣ Save scenario history
  const newScenario = {
    id: Date.now(),
    title: selectedNode?.data.label || "Untitled Scenario",
    description: promptText || "",
    flowData: flowToSaveBackend,
    createdAt: new Date().toISOString(),
  };

  const existing = JSON.parse(localStorage.getItem("scenarios") || "[]");
  existing.push(newScenario);
  localStorage.setItem("scenarios", JSON.stringify(existing));

  // 5️⃣ Navigate to play interface
  navigate("/scenarioInterface", { state: { flowData: flowToPlayFrontend } });
};
  // Placeholder for the profile image
  const profileImage =
    "https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A";

  return (
    <div className="scene-editor-container">
      <NavigationBar />
      <div className="editor-container">
        <div className="header">
          <SharedHeader
            profileImage={profileImage}
            userName="Prof Andy"
            userRole="Administrator"
          />
        </div>

        <div className="scene-editor-content">
          {/* Sidebar */}
          <div className="node-sidebar">
            {selectedNode ? (
              <>
                <h3>
                  {selectedNode.data.label || "Untitled"}
                </h3>

             
<textarea
  value={promptText}
  onChange={(e) => setPromptText(e.target.value)}
  placeholder="Refine prompt or add description"
  rows={4}
  style={{ width: "100%", marginBottom: 10 }}
/>
                <button
                  style={{ width: "100%", marginBottom: 10 }}
                  onClick={() => handleReprompt(selectedNode.id, promptText)}
                >
                  Generate Images
                </button>

                <div style={{ display: "flex", flexWrap: "wrap" }}>
                  {selectedNode.data.generatedImages?.map((imgUrl, index) => (
                    <img
                      key={index}
                      src={imgUrl}
                      alt={`Option ${index}`}
                      style={{
                        width: 100,
                        marginRight: 5,
                        marginBottom: 5,
                        cursor: "pointer",
                        border:
                          imgUrl === selectedNode.data.imageUrl
                            ? "2px solid blue"
                            : "1px solid gray",
                      }}
                      onClick={() =>
                        selectImageForNode(selectedNode.id, imgUrl)
                      }
                    />
                  ))}
                </div>

                <button
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={handleSaveAndPlay}
                >
                  💾 Save & Play Story
                </button>
              </>
            ) : (
              <div style={{ color: "#888", fontStyle: "italic" }}>
                Click a node to view details and generate images
              </div>
            )}
          </div>

          {/* 🧩 Main Editor Area */}
          <div style={{ flex: 1 }}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypesConfig}
                fitView
                onNodeClick={onNodeClick}
                onNodesChange={onNodesChange}
                nodesDraggable
                zoomOnScroll
                panOnDrag
                zoomOnPinch
                defaultEdgeOptions={{
                  animated: true,
                  type: "smoothstep",
                  style: { stroke: "#333", strokeWidth: 4 },
                }}
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneEditor;