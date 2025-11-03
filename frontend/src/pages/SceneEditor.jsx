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

// ===============================
// Config
// ===============================
const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  ending: NodeWrapper,
};

const nodeWidth = 200;
const nodeHeight = 150;
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// ===============================
// Helpers
// ===============================
const standardizeNodeData = (node) => ({
  ...node,
  data: {
    data_description:
      typeof node.data === "string" ? node.data : node.data?.data_description || "",
    options: node.options || node.data?.options || [],
    next: node.next || node.data?.next || null,
    scene: node.scene || node.data?.scene || "",
    b64image: node.b64image || node.data?.b64image || "",
    generatedImages: node.data?.generatedImages || [],
    imageUrl: node.data?.imageUrl || "",
    loadingImages: false,
  },
});

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

const generateEdgesFromNodes = (nodes) => {
  const edges = [];
  nodes.forEach((n) => {
    if (n.data.options?.length) {
      n.data.options.forEach((targetId) =>
        edges.push({
          id: `e-${n.id}-${targetId}`,
          source: n.id,
          target: targetId,
          type: "smoothstep",
          animated: true,
        })
      );
    }
    if (n.data.next) {
      edges.push({
        id: `e-${n.id}-${n.data.next}`,
        source: n.id,
        target: n.data.next,
        type: "smoothstep",
        animated: true,
      });
    }
  });
  return edges;
};

// ===============================
// Backend image generation
// ===============================
const generateImagesFromBackend = async (nodeId, prompt) => {
  try {
    const res = await fetch("http://127.0.0.1:5000/generate_images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmp: true,
        nodes: [
          {
            id: nodeId,
            data_description: `Training Scenario Visualization:
"${prompt}"
Create a realistic, cinematic-style image fitting a professional decision-making context. 
Show human emotion subtly. Avoid text or labels.`,
          },
        ],
      }),
    });

    if (!res.ok) return { images: [] };
    const data = await res.json();
  return {
  images: (data.images || [])
    .map((i) =>
      i.image_b64 && i.image_b64.length > 100
        ? `data:image/png;base64,${i.image_b64}`
        : null
    )
    .filter(Boolean),
};

  } catch (err) {
    console.error("Error calling backend:", err);
    return { images: [] };
  }
};

// ===============================
// Main component
// ===============================
const SceneEditor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const passedFlow = location.state?.flowData;
  const passedScenarioId = location.state?.scenarioId;

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [promptText, setPromptText] = useState("");
  const [scenarioId, setScenarioId] = useState(passedScenarioId || null);
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

  // Regenerate images for a node
  const handleReprompt = async (nodeId, prompt, count = 3) => {
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
  console.warn(`⚠️ Skipped empty image for node ${nodeId}`);
}

    }

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

  // Generate missing images for all nodes
  const autoGenerateImagesForAll = async (nodesList) => {
    setLoadingOverlay(true);
    await Promise.all(
      nodesList.map((node) =>
        node.data.generatedImages?.length
          ? null
          : handleReprompt(node.id, node.data.data_description)
      )
    );
    setLoadingOverlay(false);
  };

  // Initial load
  useEffect(() => {
    let flowData =
      passedFlow || JSON.parse(localStorage.getItem("latestFlow"));
    if (!flowData) return;

    if (!flowData.nodes)
      flowData = {
        nodes: Object.values(convertBackendToFrontend(flowData)),
        edges: [],
      };

    const standardizedNodes = flowData.nodes.map(standardizeNodeData);
    const layoutedNodes = getLayoutedNodes(
      standardizedNodes,
      flowData.edges || []
    );
    const edgesGenerated =
      flowData.edges || generateEdgesFromNodes(layoutedNodes);

    setNodes(layoutedNodes);
    setEdges(edgesGenerated);

    const missingImages = layoutedNodes.filter(
  (n) =>
    (!n.data?.imageUrl || n.data.imageUrl.length < 200) &&
    !n.data.loadingImages
);


    if (missingImages.length > 0) {
      console.log(
        `🖼️ Auto-generating ${missingImages.length} missing node images...`
      );
      setLoadingOverlay(true);
      autoGenerateImagesForAll(missingImages).finally(() =>
        setLoadingOverlay(false)
      );
    }
  }, [passedFlow]);
//periodic check for mising images
useEffect(() => {
  if (!nodes.length) return;

  const allImagesValid = nodes.every(
    (n) => n.data?.imageUrl && n.data.imageUrl.length >= 200
  );

  // 🧠 Don't even start interval if all are already valid
  if (allImagesValid) {
    console.log("✅ All node images already valid — skipping auto-check.");
    return;
  }

  let interval;

  const checkAndGenerate = () => {
    const missing = nodes.filter(
      (n) =>
        (!n.data?.imageUrl || n.data.imageUrl.length < 200) &&
        !n.data.loadingImages
    );

    if (missing.length > 0) {
      console.log(
        `🔁 [Auto Image Check] ${new Date().toLocaleTimeString()} → Retrying ${missing.length} node(s):`,
        missing.map((m) => m.id)
      );
      autoGenerateImagesForAll(missing);
    } else {
      console.log(
        `✅ [Auto Image Check] ${new Date().toLocaleTimeString()} → All nodes have valid images.`
      );
      clearInterval(interval);
      interval = null;
    }
  };

  checkAndGenerate();
  interval = setInterval(checkAndGenerate, 30000);

  console.log("🧠 Auto image regeneration interval started.");

  return () => {
    if (interval) {
      clearInterval(interval);
      console.log("🧹 Auto image regeneration interval cleared.");
    }
  };
}, [nodes]);


  // ====================================
// Save & Play
// ====================================
const handleSaveAndPlay = async () => {
  const updatedEdges = generateEdgesFromNodes(nodes);
  setEdges(updatedEdges);

  if (nodes.some((n) => !n.data?.data_description)) {
    alert("Some nodes have no descriptions. Please fill them before saving!");
    return;
  }

  // Clean node data
const cleanNodes = nodes.map((n) => ({
  ...n,
  data: {
    data_description: n.data.data_description || "Untitled",
    imageUrl: n.data.imageUrl || "",
    b64image: n.data.imageUrl?.startsWith("data:image/")
      ? n.data.imageUrl.split(",")[1] // extract base64 part
      : n.data.b64image || "",
    generatedImages: n.data.generatedImages || [],
    options: n.data.options || [],
    next: n.data.next || null,
  },
}));


  // ✅ Convert for backend — produces array of nodes
  const flowToSaveBackend = {
    nodes: convertFrontendToBackend(
      Object.fromEntries(cleanNodes.map((n) => [n.id, n]))
    ),
    edges: updatedEdges,
  };

  // Debug logging
  console.log("🧠 Scenario ID before save:", scenarioId);
  console.log(
    "🛰️ Sending flowData to backend:",
    flowToSaveBackend.nodes.map((n) => ({
      id: n.id,
      options: n.data?.options,
      next: n.data?.next,
    }))
  );

  const updatedScenario = {
    id: /^[0-9a-fA-F]{24}$/.test(scenarioId) ? scenarioId : null,
    title: scenarioTitle || "Untitled Scenario",
    description: "",
    flowData: flowToSaveBackend,
    lastEdited: new Date().toISOString(),
  };

  try {
    const res = await fetch("http://127.0.0.1:5000/scenarios/saveFlow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedScenario),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Save failed");

    let finalScenarioId = scenarioId;
    if (data.scenarioId) {
      setScenarioId(data.scenarioId);
      finalScenarioId = data.scenarioId;
    }

    console.log("✅ Final Scenario ID for navigation:", finalScenarioId);

    navigate("/scenarioInterface", {
      state: {
        scenarioId: finalScenarioId,
        flowData: {
          startNodeId: cleanNodes[0].id,
          nodes: cleanNodes,
          edges: updatedEdges,
        },
      },
    });
  } catch (err) {
    console.error("Save error:", err);
    alert("⚠️ Error saving scenario. Check console for details.");
  }
};

  // ===============================
  // Render
  // ===============================
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
          <div className="action-button-container">
            <button style={{ marginTop: 70 }} onClick={handleSaveAndPlay}>
              💾 Save & Play Story
            </button>

            {/* Sidebar */}
            <div className="node-sidebar">
              {selectedNode ? (
                <>
                  <h3 className="sidebar-node-title">
                    🧩 Node {selectedNode.id}
                  </h3>

                  <div className="sidebar-section">
                    <label className="sidebar-label">
                      Prompt / Description
                    </label>
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="Edit prompt text..."
                      rows={4}
                      className="sidebar-textarea"
                    />
                    <div className="sidebar-actions">
                      <button
                        className="sidebar-generate-btn"
                        onClick={() =>
                          handleReprompt(selectedNode.id, promptText, 4)
                        }
                        disabled={selectedNode.data.loadingImages}
                      >
                        {selectedNode.data.loadingImages
                          ? "⚙️ Generating..."
                          : "✨ Regenerate Images"}
                      </button>
                    </div>
                  </div>

                  <div className="sidebar-section">
                    <label className="sidebar-label">
                      Generated Variations
                    </label>
                    {selectedNode.data.generatedImages?.length > 0 ? (
                      <div className="image-grid">
                        {selectedNode.data.generatedImages.map((imgUrl, i) => (
                          <div key={i} className="image-option">
                            <img
                              src={imgUrl}
                              alt={`Option ${i}`}
                              className={`image-thumb ${
                                imgUrl === selectedNode.data.imageUrl
                                  ? "selected"
                                  : ""
                              }`}
                              onClick={() =>
                                selectImageForNode(selectedNode.id, imgUrl)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: "#888", fontStyle: "italic" }}>
                        No images generated yet. Click ✨ to generate.
                      </p>
                    )}
                  </div>

                  {selectedNode.data.imageUrl && (
                    <div className="sidebar-section">
                      <label className="sidebar-label">Selected Image</label>
                      <img
                        src={selectedNode.data.imageUrl}
                        alt="Selected"
                        className="selected-image-preview"
                      />
                    </div>
                  )}

                  <div className="sidebar-footer">
                    {selectedNode.data.loadingImages ? (
                      <span className="saving-status">⚙️ Generating...</span>
                    ) : (
                      <span className="saving-status">💾 Auto-saved</span>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: "#888", fontStyle: "italic" }}>
                  Click a node to edit prompt and images
                </div>
              )}
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneEditor;
