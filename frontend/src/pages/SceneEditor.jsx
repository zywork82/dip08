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
import localforage from "localforage";


import "reactflow/dist/style.css";
import "../styles/SceneEditor.css";
import { sanitizeFlowForNavigation } from "../utils/flowSanitiser";
// 🚫 Gemini quota exhaustion guard
let GEMINI_QUOTA_EXCEEDED = false;
// 🚨 Global stop flag
let stopGeneration = false;
let AUTO_GEN_RUNNING = false;



          // ===============================
// 🧩 Helper: Validate image quality
// ===============================
const hasValidImage = (node) => {
  const url = node.data?.imageUrl || "";
  const b64 = node.data?.b64image || "";

  // Nothing at all
  if (!url && !b64) return false;

  // Placeholder patterns or tiny inline base64
  if (
    url.includes("placehold") ||          // placeholder.co
    url.includes("placeholder") ||        // any "placeholder" text
    url.includes("dummyimage") ||         // dummy image service
    url.startsWith("blob:") ||            // temporary blobs
    (url.startsWith("data:image") && url.length < 300) || // tiny base64s
    (b64 && b64.length < 300)             // too short to be real image
  ) {
    return false;
  }

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

const nodeWidth = 200;
const nodeHeight = 150;
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
dagreGraph.setGraph({ rankdir: "TB", ranksep: 300, nodesep: 250 });


// ===============================
// Helpers
// ===============================
const standardizeNodeData = (node, handleReprompt) => ({
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
    failedImage: node.data?.failedImage || false,

    // ✅ Add retry callback (connected to SceneEditor’s function)
    onRetry: (nodeId) => handleReprompt(nodeId, node.data?.data_description || ""),
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
   if (GEMINI_QUOTA_EXCEEDED) {
    console.warn("🚫 Skipping image generation — Gemini quota already exceeded.");
    return { images: [] };
  }
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

useEffect(() => {
  (async () => {
    const storedScenarioId = await localforage.getItem("lastScenarioId");
    if (!scenarioId && storedScenarioId) {
      setScenarioId(storedScenarioId);
    }
  })();
}, []);

useEffect(() => {
  const fetchScenarioFromBackend = async () => {
    try {
      const idToLoad = passedScenarioId || scenarioId || localStorage.getItem("lastScenarioId");
      if (!idToLoad) return;

      console.log(`🌐 Fetching full scenario from backend: ${idToLoad}`);
    const res = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${idToLoad}`);

      if (!res.ok) throw new Error("Failed to fetch scenario from backend");

      const data = await res.json();
      if (!data.nodes) {
        console.warn("⚠️ No nodes found in backend scenario:", data);
        return;
      }

      // Convert backend → frontend format
      const frontendFlow = convertBackendToFrontend(data);
      const standardizedNodes = Object.values(frontendFlow.nodes).map((n) =>
        standardizeNodeData(n, handleReprompt)
      );

      const layoutedNodes = getLayoutedNodes(standardizedNodes, data.edges || []);
      setNodes(layoutedNodes);
      setEdges(data.edges || generateEdgesFromNodes(layoutedNodes));

      console.log("✅ Loaded scenario with images from backend");
    } catch (err) {
      console.error("❌ Failed to fetch scenario from backend:", err);
    }
  };

  fetchScenarioFromBackend();
}, [passedScenarioId]);

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

    const debounce = setTimeout(async () => {
  try {
    const localFlow = (await localforage.getItem("latestFlow")) || {};
    const lightweightNode = {
      id: selectedNode.id,
      data: {
        data_description: promptText,
        options: selectedNode.data?.options || [],
        next: selectedNode.data?.next || null,
      },
    };
    localFlow[selectedNode.id] = lightweightNode;
    await localforage.setItem("latestFlow", localFlow);
    console.log("✅ Auto-saved lightweight node", selectedNode.id);
  } catch (e) {
    console.warn("⚠️ Skipped auto-save — storage quota exceeded or blocked.", e);
  }
}, 1500);


    return () => clearTimeout(debounce);
  }, [promptText, selectedNode]);

const handleAutoLayout = () => {
  const newLayout = getLayoutedNodes(nodes, edges);
  setNodes(newLayout);
};

 // ===============================
// ✅ Regenerate images for a node (with fail tracking)
// ===============================
const handleReprompt = async (nodeId, prompt, count = 1) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (node?.data.loadingImages) {
    console.log(`⚠️ Skipping duplicate generation for node ${nodeId}`);
    return;
  }

  // Set loading state
  setNodes((nds) =>
    nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, loadingImages: true, failedImage: false } }
        : n
    )
  );

  try {
    const res = await fetch("http://127.0.0.1:5000/scenarios/updateImage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId,
        description: `Training Scenario Visualization:
"${prompt}"
Create a realistic, cinematic-style image fitting a professional decision-making context. 
Show human emotion subtly. Avoid text or labels.`,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Backend error during image regeneration");
    }

    // ✅ Convert backend base64 strings → proper URLs
    const imageUrls = (data.images || [])
      .map((b64) => (b64 ? `data:image/png;base64,${b64}` : null))
      .filter(Boolean);

    if (imageUrls.length === 0) {
      console.warn(`⚠️ No images returned for node ${nodeId}`);
      throw new Error("No images returned from backend");
    }

    // ✅ Update node data with new images
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                imageUrl: imageUrls[0],
                generatedImages: [
                  ...(n.data.generatedImages || []),
                  ...imageUrls,
                ].slice(-5),
                loadingImages: false,
                failedImage: false,
              },
            }
          : n
      )
    );

    console.log(`✅ Updated ${imageUrls.length} regenerated images for node ${nodeId}`);
  } catch (err) {
    console.error("❌ handleReprompt error:", err);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                loadingImages: false,
                failedImage: true,
              },
            }
          : n
      )
    );
  }
};



  // Select preferred image
  const selectImageForNode = (nodeId, imgUrl) =>
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, imageUrl: imgUrl } } : n
      )
    );


// ✅ Sequential auto-generation (one node at a time)
const autoGenerateImagesForAll = async (nodesList) => {
  if (AUTO_GEN_RUNNING) {
    console.warn("🚫 Auto image generation already in progress. Skipping duplicate run.");
    return;
  }
  AUTO_GEN_RUNNING = true;
  setLoadingOverlay(true);
  stopGeneration = false;

  for (const node of nodesList) {
    if (stopGeneration) break;
    const hasImages = node.data.generatedImages?.length > 0;
    const failed = node.data.failedImage;
    if (!hasImages && !failed) {
      await handleReprompt(node.id, node.data.data_description);
    }
  }

  AUTO_GEN_RUNNING = false;
  setLoadingOverlay(false);
};



  // Initial load
  useEffect(() => {
  (async () => {
    let flowData =
      passedFlow || (await localforage.getItem("latestFlow"));
    if (!flowData) return;

    if (!flowData.nodes) {
      flowData = {
        nodes: Object.values(convertBackendToFrontend(flowData)),
        edges: [],
      };
    }

    const standardizedNodes = flowData.nodes.map((n) =>
      standardizeNodeData(n, handleReprompt)
    );

    const layoutedNodes = getLayoutedNodes(
      standardizedNodes,
      flowData.edges || []
    );
    const edgesGenerated =
      flowData.edges || generateEdgesFromNodes(layoutedNodes);

    setNodes(layoutedNodes);
    setEdges(edgesGenerated);

    // 🧠 Diagnostic check for image completeness
    const totalNodes = layoutedNodes.length;
    const nodesWithImages = layoutedNodes.filter(hasValidImage).length;
    const missingImages = layoutedNodes.filter((n) => !hasValidImage(n));

    console.log(`🧩 Image status check → ${nodesWithImages}/${totalNodes} nodes have valid images.`);

    if (missingImages.length > 0) {
      const trulyMissing = missingImages.filter(
        (n) => !n.data?.b64image || n.data.b64image.length < 100
      );

      if (trulyMissing.length > 0) {
        console.warn(`🖼️ Auto-generating ${trulyMissing.length} *new* missing images...`);
        setLoadingOverlay(true);
        autoGenerateImagesForAll(trulyMissing).finally(() =>
          setLoadingOverlay(false)
        );
      } else {
        console.log("✅ All nodes have stored base64 images. Skipping regeneration.");
      }
    } else {
      console.log("✅ All nodes already have valid images. Skipping generation.");
    }
  })();
}, [passedFlow]);

// ===============================
// ✅ Periodic check for missing images (safe + single interval)
// ===============================
const hasStartedAutoCheck = React.useRef(false);

useEffect(() => {
  if (hasStartedAutoCheck.current || !nodes.length) return;
  hasStartedAutoCheck.current = true;

  const checkAndGenerate = () => {
    const missing = nodes.filter(
      (n) =>
        (!n.data?.imageUrl || n.data.imageUrl.length < 200) &&
        !n.data.loadingImages &&
        !n.data.failedImage
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
    }
  };

  // run once on start
  checkAndGenerate();

  const interval = setInterval(checkAndGenerate, 30000);
  console.log("🧠 Auto image regeneration interval started.");

  return () => {
    clearInterval(interval);
    console.log("🧹 Auto image regeneration interval cleared.");
  };
}, [nodes]);

 // ====================================
// Save & Play (optimized payload)
// ====================================
const handleSaveAndPlay = async () => {
  let finalScenarioId = scenarioId;
  const updatedEdges = generateEdgesFromNodes(nodes);
  setEdges(updatedEdges);

  // Check missing descriptions
  const missing = nodes.filter((n) => !n.data?.data_description?.trim());
if (missing.length > 0) {
  console.warn("⚠️ Nodes missing descriptions:", missing.map((n) => n.id));
  // (optional) Auto-fill placeholders
  setNodes((nds) =>
    nds.map((n) =>
      !n.data?.data_description?.trim()
        ? {
            ...n,
            data: {
              ...n.data,
              data_description: "(Auto-filled placeholder)",
            },
          }
        : n
    )
  );
}


  // ✅ Prepare clean, full node data
  const cleanNodes = nodes.map((n) => {
    let imageUrl = n.data.imageUrl || "";
    let b64image = "";

    // 🧹 Extract and clean inline base64 URLs
    if (imageUrl.startsWith("data:image/")) {
      b64image = imageUrl.split(",")[1]; // extract raw base64
      imageUrl = ""; // remove heavy inline base64 from the URL
    } else {
      b64image = n.data.b64image || "";
    }

    return {
      ...n,
      data: {
        data_description: n.data.data_description || "Untitled",
        scene: n.data.scene || "",
        options: n.data.options || [],
        next: n.data.next || null,
        imageUrl,
        b64image,
        generatedImages: n.data.generatedImages || [],
      },
    };
  });

  
// ✅ Detect only *new* base64 images (not ones already stored)
const hasNewImages = cleanNodes.some(
  (n) =>
    n.data.imageUrl?.startsWith("data:image/") &&
    (!n.data.b64image || n.data.b64image.length < 100)
);

  // 🪶 strip heavy base64 if no new images
const payloadNodes = hasNewImages
  ? cleanNodes
  : cleanNodes.map((n) => ({
      ...n,
      data: { ...n.data, b64image: "" },
    }));

  // ✅ Convert for backend (uses your helper correctly)
  const flowToSaveBackend = {
    nodes: convertFrontendToBackend(
      Object.fromEntries(payloadNodes.map((n) => [n.id, n]))
    ),
    edges: updatedEdges,
  };

  // 🧠 Debug log
  console.log(
    hasNewImages
      ? "🛰️ Sending flowData with new images to backend:"
      : "🛰️ Sending flowData (no new images, base64 trimmed):",
    flowToSaveBackend.nodes
  );

  // ✅ Build request body
  const updatedScenario = {
    id: /^[0-9a-fA-F]{24}$/.test(scenarioId) ? scenarioId : null,
    title: scenarioTitle || "Untitled Scenario",
    description: "",
    nodes: Object.values(flowToSaveBackend.nodes), // Flatten nodes object into array
    edges: flowToSaveBackend.edges || [],
    lastEdited: new Date().toISOString(),
  };

  try {
    console.log("🌐 About to fetch:", JSON.stringify(updatedScenario, null, 2));

    const res = await fetch("http://127.0.0.1:5000/scenarios/saveFlow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedScenario),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Save failed");

    // ✅ Update scenarioId if new
    if (data.scenarioId) {
  setScenarioId(data.scenarioId);
  finalScenarioId = data.scenarioId;
  try {
    await localforage.setItem("lastScenarioId", finalScenarioId);
  } catch (err) {
    console.warn("⚠️ Failed to save lastScenarioId to IndexedDB, falling back to localStorage:", err);
    localStorage.setItem("lastScenarioId", finalScenarioId);
  }
}


    console.log("✅ Saved scenario successfully:", finalScenarioId);

    // ✅ Navigate to SimulationInterface
    navigate("/simulation", {
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
        <div className="floating-toolbar">
  <button onClick={handleSaveAndPlay}>💾 Save & Play</button>
{/* 
  <button
    onClick={() => selectedNode && handleReprompt(selectedNode.id, promptText)}
    disabled={!selectedNode}
  >
    ✨ Regenerate Selected
  </button> */}
<button onClick={handleAutoLayout}>🧭 Auto Layout</button>

  <button
    onClick={() => {
      const missing = nodes.filter((n) => !hasValidImage(n));
      if (missing.length === 0) {
        alert("✅ All nodes already have valid images!");
        return;
      }

      console.log(`🖼️ Regenerating ${missing.length} missing/placeholder images...`);
      autoGenerateImagesForAll(missing);
    }}
    disabled={loadingOverlay}
  >
    🔁 Regenerate All
  </button>

  <button
    onClick={() => {
      const lightweightFlow = getLightweightFlow(nodes, edges);
      navigate("/editor", { state: { scenarioId, flowData: lightweightFlow } });
    }}
  >
    🗺️ Back to Flow
  </button>
</div>



        <div className="scene-editor-content">
          <div className="action-button-container">
            {/* Sidebar */}
           <div className="node-sidebar">
  {selectedNode ? (
    <>
      <div className="sidebar-header">
        <span className="nodeTitle">🧩 Node {selectedNode.id}</span>
        <p className="sidebar-subtitle">
          {selectedNode.type?.toUpperCase() || "SCENE"}
        </p>
      </div>

      <div className="sidebar-scrollable">
        {/* === Prompt Section === */}
        <details open className="sidebar-section">
          <summary>✏️ Prompt / Description</summary>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Edit prompt text..."
            rows={4}
            className="sidebar-textarea"
          />
          <button
            className="sidebar-generate-btn"
            onClick={() => handleReprompt(selectedNode.id, promptText, 4)}
            disabled={selectedNode.data.loadingImages}
          >
            {selectedNode.data.loadingImages
              ? "⚙️ Generating..."
              : "✨ Regenerate Images"}
          </button>
        </details>

        {/* === Variations Section === */}
        <details open className="sidebar-section-variations">
          <summary>🎨 Generated Variations</summary>
          {selectedNode.data.generatedImages?.length > 0 ? (
            <div className="image-carousel">
              {selectedNode.data.generatedImages.map((imgUrl, i) => (
                <div
                  key={i}
                  className={`image-thumb-wrapper ${
                    imgUrl === selectedNode.data.imageUrl ? "selected" : ""
                  }`}
                  onClick={() => selectImageForNode(selectedNode.id, imgUrl)}
                >
                  <img src={imgUrl} alt={`Option ${i}`} className="image-thumb" />
                </div>
              ))}
            </div>
          ) : (
            <p className="sidebar-empty-text">
              No images generated yet. Click ✨ to generate.
            </p>
          )}
        </details>

        {/* === Selected Image Section === */}
        {selectedNode.data.imageUrl && (
          <details open className="sidebar-section">
            <summary>🖼️ Selected Image</summary>
            <img
              src={selectedNode.data.imageUrl}
              alt="Selected"
              className="selected-image-preview"
            />
          </details>
        )}
      </div>

      <div className="sidebar-footer">
        {selectedNode.data.loadingImages ? (
          <span>⚙️ Generating...</span>
        ) : (
          <span>💾 Auto-saved</span>
        )}
      </div>
    </>
  ) : (
    <div className="sidebar-empty">
      <p>Click a node to edit prompt and images</p>
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

  fitViewOptions={{ padding: 0.2, duration: 500 }}
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
