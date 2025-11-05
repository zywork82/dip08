// src/pages/SceneEditor.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactFlow, {
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
} from "reactflow";
import dagre from "dagre";
import NodeWrapper from "../components/NodeWrapper";
import NavigationBar from "../components/SlimNavBar";
import SharedHeader from "../components/SharedHeader";
import {
  convertFrontendToBackend,
  convertBackendToFrontend,
} from "../utils/flowConverter";

import "reactflow/dist/style.css";
import "../styles/SceneEditor.css";

// 🚫 Gemini quota exhaustion guard
let GEMINI_QUOTA_EXCEEDED = false;
// 🚨 Global stop flag
let stopGeneration = false;


          // ===============================
// 🧩 Helper: Validate image quality
// ===============================
const hasValidImage = (node) => {
  const url = node.data?.imageUrl || "";
  const b64 = node.data?.b64image || "";
  // Ignore 1x1 placeholders or empty strings
  if (!url && !b64) return false;
  if (url.includes("placehold") || url.length < 100) return false;
  return true;
};

const getLightweightFlow = (nodes, edges) => {
  const lightNodes = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      data_description: n.data?.data_description || "",
      options: n.data?.options || [],
      next: n.data?.next || null,
      scene: n.data?.scene || "",
      // ✅ only keep image URL reference (no base64!)
      imageUrl: n.data?.imageUrl || "",
    },
  }));
  return { nodes: lightNodes, edges };
};

// ===============================
// Config
// ===============================
const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  ending: NodeWrapper,
};

  // Dagre layout config
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const nodeWidth = 200;
  const nodeHeight = 150;

  const standardizeNodeData = (node) => {
    const data_description =
      typeof node.data === "string"
        ? node.data
        : node.data?.data_description || node.data?.label || "";

    return {
      ...node,
      data: {
        data_description,
        options: node.options || node.data?.options || [],
        next: node.next || node.data?.next || null,
        scene: node.scene || node.data?.scene || "",
        b64image: node.b64image || node.data?.b64image || "",
        generatedImages: node.data?.generatedImages || [],
        imageUrl: node.data?.imageUrl || null,
        loadingImages: false,
        ...(typeof node.data === "object" ? node.data : {}),
      },
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

  // ===== Backend Image Generation =====
  const generateImagesFromBackend = async (nodeId, prompt) => {
    try {
      const res = await fetch("http://127.0.0.1:5000/generate_images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmp: true,
          nodes: [{ id: nodeId, data_description: prompt }],
        }),
      });
      if (!res.ok) return { images: [] };
      const data = await res.json();
      return {
        images: data.images?.map((i) => `data:image/png;base64,${i.image_b64}`) || [],
      };
    } catch (err) {
      console.error("Error calling backend:", err);
      return { images: [] };
    }
  };

  const SceneEditor = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const passedFlow = location.state?.flowData;

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [promptText, setPromptText] = useState("");
// ✅ Load scenarioId from navigation OR fallback to localStorage
const storedScenarioId = localStorage.getItem("lastScenarioId");
const passedScenarioId = location.state?.scenarioId;
const [scenarioId, setScenarioId] = useState(passedScenarioId || storedScenarioId || null);

  const [scenarioTitle, setScenarioTitle] = useState("Untitled Scenario");
  const [loadingOverlay, setLoadingOverlay] = useState(false);

  const profileImage =
    "https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A";

  // Node selection
  const onNodeClick = (_, node) => {
    setSelectedNode(node);
    setPromptText(node.data.data_description || "");
  };

  const onNodesChange = (changes) =>
    setNodes((nds) => applyNodeChanges(changes, nds));

  // Update prompt edits
  useEffect(() => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, data_description: promptText } }
          : n
      )
    );
  }, [promptText, selectedNode]);

  // Auto-save prompt edits (lightweight)
  useEffect(() => {
    if (!selectedNode) return;

    const debounce = setTimeout(() => {
      try {
        const localFlow = JSON.parse(localStorage.getItem("latestFlow") || "{}");
        const lightweightNode = {
          id: selectedNode.id,
          data: {
            data_description: promptText,
            options: selectedNode.data?.options || [],
            next: selectedNode.data?.next || null,
          },
        };
        localFlow[selectedNode.id] = lightweightNode;
        localStorage.setItem("latestFlow", JSON.stringify(localFlow));
        console.log("✅ Auto-saved lightweight node", selectedNode.id);
      } catch (e) {
        console.warn("⚠️ Skipped auto-save — storage quota exceeded.", e);
      }
    }, 1500);

    return () => clearTimeout(debounce);
  }, [promptText, selectedNode]);

 // ===============================
// ✅ Regenerate images for a node (with fail tracking)
// ===============================
const handleReprompt = async (nodeId, prompt, count = 3) => {
  // Mark node as loading
  setNodes((nds) =>
    nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, loadingImages: true } } : n
    )
  );

  const variations = [];

  for (let i = 0; i < count; i++) {
    const data = await generateImagesFromBackend(
      nodeId,
      prompt + ` (variation ${i + 1})`
    );

    if (data.images?.length > 0) {
      variations.push(...data.images);
    } else {
      console.warn(`⚠️ Skipped empty image for node ${nodeId} (try ${i + 1})`);
    }
  }

  if (variations.length === 0) {
    console.warn(`❌ No images generated for node ${nodeId}, marking failed.`);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                loadingImages: false,
                failedImage: true,
                generatedImages: [],
                imageUrl: "",
              },
            }
          : n
      )
    );
    return;
  }

  // Success: update with new images
  setNodes((nds) =>
    nds.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              generatedImages: variations,
              imageUrl: variations[0] || "",
              loadingImages: false,
              failedImage: false,
            },
          }
        : n
    )
  );
};

  // Select preferred image
  const selectImageForNode = (nodeId, imgUrl) =>
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, imageUrl: imgUrl } } : n
      )
    );


// ✅ Sequential auto-generation (one node at a time)
// ===============================
const autoGenerateImagesForAll = async (nodesList) => {
  setLoadingOverlay(true);
  stopGeneration = false; // reset before starting

  for (const node of nodesList) {
    if (stopGeneration) {
      console.log("🛑 Generation stopped mid-process.");
      break;
    }

    const hasImages = node.data.generatedImages?.length > 0;
    const failed = node.data.failedImage;
    if (!hasImages && !failed) {
      await handleReprompt(node.id, node.data.data_description);
    }
  }

  setLoadingOverlay(false);
};


  // Initial load
  useEffect(() => {
    let flowData =
      passedFlow || JSON.parse(localStorage.getItem("latestFlow"));
    if (!flowData) return;

      if (!flowData.nodes) {
        const frontendFlow = convertBackendToFrontend(flowData);
        flowData = { nodes: Object.values(frontendFlow), edges: [] };
      }

      const standardizedNodes = flowData.nodes.map(standardizeNodeData);
      const layouted = getLayoutedNodes(standardizedNodes, flowData.edges || []);
      setEdges(flowData.edges || []);
      setNodes(layouted);

      autoGenerateImagesForAll(layouted); // async per node
    }, [passedFlow]);

    // Save & Play
    const handleSaveAndPlay = () => {
      const cleanNodes = nodes.map((n) => ({
        ...n,
        data: {
          data_description: n.data.data_description || "Untitled",
          imageUrl: n.data.imageUrl,
          generatedImages: n.data.generatedImages || [],
          options: n.data.options || [],
          next: n.data.next || null,
        },
        position: undefined,
        width: undefined,
        height: undefined,
      }));

      const flowToPlayFrontend = { startNodeId: cleanNodes[0].id, nodes: cleanNodes, edges };

      const flowToSaveBackend = convertFrontendToBackend(
        cleanNodes.reduce((acc, node) => {
          acc[node.id] = node;
          return acc;
        }, {})
      );

      localStorage.setItem("latestFlow", JSON.stringify(flowToSaveBackend));

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

      navigate("/scenarioInterface", { state: { flowData: flowToPlayFrontend } });
    };



    return (
      <div className="scene-editor-container">
        <NavigationBar />
        <div className="editor-container">
          <div className="header">
            <SharedHeader profileImage={profileImage} userName="Prof Andy" userRole="Administrator" />
          </div>

          <div className="scene-editor-content">
            <div className="node-sidebar">
              {selectedNode ? (
                <>
                  <h3>{selectedNode.data.label || "Untitled"}</h3>
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
    disabled={selectedNode.data.loadingImages}
  >
    {selectedNode.data.loadingImages ? "Generating..." : "Generate Images"}
  </button>

                  <div className="image-grid">
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
                          border: imgUrl === selectedNode.data.imageUrl ? "2px solid blue" : "1px solid gray",
                        }}
                        onClick={() => selectImageForNode(selectedNode.id, imgUrl)}
                      />
                    ))}
                  </div>

                  <button style={{ width: "100%", marginTop: 10 }} onClick={handleSaveAndPlay}>
                    💾 Save & Play Story
                  </button>
                </>
              ) : (
                <div style={{ color: "#888", fontStyle: "italic" }}>Click a node to view details and generate images</div>
              )}
            </div>

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
                  style: { stroke: "#333", strokeWidth: 3 },
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

      {loadingOverlay && (
  <div className="loading-overlay">
    <div className="loading-box">
      <div className="spinner"></div>
      <p>Auto-generating missing images...</p>

      <button
        disabled={!loadingOverlay}
        style={{
          marginTop: 10,
          backgroundColor: loadingOverlay ? "#c62828" : "#aaa",
          color: "white",
          cursor: loadingOverlay ? "pointer" : "not-allowed",
          border: "none",
          padding: "8px 16px",
          borderRadius: "8px",
        }}
        onClick={() => {
          stopGeneration = true;
          setLoadingOverlay(false);
          console.warn("🛑 Generation manually stopped by user.");

          // 🔥 Notify backend to stop accepting new generations
          fetch("http://127.0.0.1:5000/stop_generation", { method: "POST" })
            .then(() => console.log("🧠 Stop signal sent to backend"))
            .catch((err) => console.warn("⚠️ Backend stop request failed:", err));
        }}
      >
        🛑 Stop Generation
      </button>
    </div>
  </div>
)}

      
    </div>
  );
};

  export default SceneEditor;
