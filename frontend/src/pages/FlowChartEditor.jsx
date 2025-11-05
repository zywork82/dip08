import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MiniMap,
  Controls,
  Background,
} from "reactflow";
import dagre from "dagre";
import EditorToolsSidebar from "../components/EditorToolsSidebar";
import NodeWrapper from "../components/NodeWrapper";
import "reactflow/dist/style.css";

import SharedHeader from "../components/SharedHeader";
import NavigationBar from "../components/SlimNavBar";
import { sampleNodes, sampleAiSuggestions, sampleEdges } from "../data/sampleAiFlow";
import { sanitizeFlowForNavigation } from "../utils/flowSanitiser";
import "../styles/FlowChartEditor.css";
const profileImage =
  "https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg";

const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  ending: NodeWrapper,
};

// DAGRE layout setup
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 200;
const nodeHeight = 150;
const getLayoutedNodes = (nodes, edges) => {
  dagreGraph.setGraph({
    rankdir: "TB",      // top → bottom
    ranksep: 160,       // vertical distance between layers
    nodesep: 160,       // horizontal spacing between siblings
    marginx: 100,
    marginy: 100,
    align: "UL",        // consistent left alignment
  });

  nodes.forEach((n) =>
    dagreGraph.setNode(n.id, { width: nodeWidth, height: nodeHeight })
  );
  edges.forEach((e) => dagreGraph.setEdge(e.source, e.target));
  dagre.layout(dagreGraph);

  return nodes.map((n) => {
    const layoutNode = dagreGraph.node(n.id);
    return layoutNode
      ? {
          ...n,
          position: {
            x: layoutNode.x - nodeWidth / 2,
            y: layoutNode.y - nodeHeight / 2,
          },
        }
      : n;
  });
};


// === Helpers ===
const generateEdgesFromNodes = (nodes) => {
  const edges = [];
  nodes.forEach((n) => {
    const d = n.data || {};
    if (n.type === "scenario" && d.options?.length) {
      d.options.forEach((optId) => {
        if (nodes.find((x) => x.id === optId)) {
          edges.push({
            id: `e-${n.id}-${optId}`,
            source: n.id,
            target: optId,
            type: "smoothstep",
            animated: true,
          });
        }
      });
    }
    if (n.type === "option" && d.next) {
      if (nodes.find((x) => x.id === d.next)) {
        edges.push({
          id: `e-${n.id}-${d.next}`,
          source: n.id,
          target: d.next,
          type: "smoothstep",
          animated: true,
        });
      }
    }
  });
  // ✅ remove duplicate edges
  return Array.from(new Map(edges.map((e) => [e.id, e])).values());
};
const filterLetteredNodes = (nodes) => {
  return nodes.filter((n) => {
    const id = n.id?.toString() || "";
    const isEnding = /^E\d+$/i.test(id);
    const isScenario = n.type === "scenario";
    const isOption = n.type === "option";
    return isScenario || isOption || isEnding;
  });
};



// === Remove unconnected group nodes (like 202, 301) ===
const filterDisconnectedNodes = (nodes, edges) => {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return nodes;

  const filtered = nodes.filter((n) => {
    const id = n.id?.toString() || "";
    const isGroupNode = /^\d+$/.test(id);
    const isEndingNode = /^E\d+$/i.test(id); // ✅ mark endings like E1, E2, E3
    const hasOptions = Array.isArray(n.data?.options) && n.data.options.length > 0;
    const hasConnections = edges.some((e) => e.source === id || e.target === id);

    // 🧠 Keep ending nodes, group nodes that are connected, or have options
    return isEndingNode || !isGroupNode || hasOptions || hasConnections;
  });

  const removed = nodes.length - filtered.length;
  if (removed > 0) console.log(`🧹 Removed ${removed} disconnected node(s)`);

  return filtered;
};


// === Duplicate detection ===
const findDuplicateDescriptions = (nodes) => {
  const map = {};
  nodes.forEach((n) => {
    const desc = n.data.data_description?.trim();
    if (!desc) return;
    map[desc] = map[desc] ? [...map[desc], n.id] : [n.id];
  });
  return Object.entries(map)
    .filter(([_, ids]) => ids.length > 1)
    .map(([desc, ids]) => ({ desc, ids }));
};

// === Standardize Node Data ===
const standardizeNodeData = (node) => {
  const d = typeof node.data === "object" ? node.data : { data_description: node.data || "" };
  return {
    ...node,
    data: {
      ...d,
      options: node.options || d.options || [],
      next: node.next || d.next || null,
      scene: node.scene || d.scene || "",
      b64image: node.b64image || d.b64image || "",
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
  const [scenarioId, setScenarioId] = useState(null);
  const [scenarioTitle, setScenarioTitle] = useState("Untitled Scenario");

  const navigate = useNavigate();
  const location = useLocation();
  const backendFlow = location.state?.flowData;
  const [loadingImages, setLoadingImages] = useState(false);
const [imageProgress, setImageProgress] = useState(0);

// === Log updates to localStorage ===
// === Local change logger ===
const logChange = useCallback((action, node) => {
  const entry = {
    time: new Date().toISOString(),
    action,
    nodeId: node.id,
    nodeType: node.type,
    data: node.data,
  };

  console.log("🧩 Change logged:", entry); // <-- verify this fires

  const logs = JSON.parse(localStorage.getItem("flowChangeLog") || "[]");
  logs.push(entry);
  localStorage.setItem("flowChangeLog", JSON.stringify(logs));
}, []);

// === Node label editing ===
const handleNodeLabelChange = useCallback(
  (id, e) => {
    const value = e.target.value;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          const updated = { ...n, data: { ...n.data, data_description: value } };
          // Log this change
          logChange("edit_label", updated);
          return updated;
        }
        return n;
      })
    );
  },
  [logChange]
);

  // === Node deletion with cleanup ===
  const removeNode = useCallback((nodeId) => {
  setNodes((nds) => {
    const updatedNodes = nds
      .filter((n) => n.id !== nodeId)
      .map((n) => ({
        ...n,
        data: {
          ...n.data,
          options: (n.data.options || []).filter((o) => o !== nodeId),
          next: n.data.next === nodeId ? null : n.data.next,
        },
      }));

    // 🔹 Find the node that got deleted for logging
    const deletedNode = nds.find((n) => n.id === nodeId);
    if (deletedNode) logChange("delete_node", deletedNode);

    return updatedNodes;
  });

  // Remove related edges
  setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
}, [logChange]);

  // === ReactFlow handlers ===
  const onNodesChange = useCallback(
    (changes) =>
      setNodes((nds) =>
        applyNodeChanges(changes, nds).map((n) => ({
          ...n,
          data: { ...nds.find((x) => x.id === n.id)?.data },
        }))
      ),
    []
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback((connection) => {
    setEdges((eds) =>
      Array.from(
        new Map(
          addEdge({ ...connection, type: "smoothstep", animated: true }, eds).map((e) => [
            e.id,
            e,
          ])
        ).values()
      )
    );

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === connection.source) {
          if (n.type === "scenario") {
            const options = new Set(n.data.options || []);
            options.add(connection.target);
            return { ...n, data: { ...n.data, options: Array.from(options) } };
          }
          if (n.type === "option") {
            return { ...n, data: { ...n.data, next: connection.target } };
          }
        }
        return n;
      })
    );
  }, []);

  const onEdgeClick = useCallback((_, edge) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, []);

const autoLayout = () => {
  setNodes((nds) => getLayoutedNodes(nds, edges));
  if (reactFlowInstance) setTimeout(() => reactFlowInstance.fitView(), 150);
};


  // === Drop handler ===
  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      let data;
      try {
        data = JSON.parse(event.dataTransfer.getData("application/reactflow"));
      } catch {
        const type = event.dataTransfer.getData("application/reactflow");
        if (!type) return;
        data = { nodeType: type, data_description: `New ${type}` };
      }

      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      const id = `${data.nodeType}_${Date.now()}`;

      const newNode = standardizeNodeData({
        id,
        type: data.nodeType,
        position,
        data: {
          data_description: data.data_description || `New ${data.nodeType}`,
          options: [],
          next: null,
          scene: "",
          b64image: "",
        },
      });

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance]
  );
// === Auto Layout (with cleanup of disconnected nodes) ===
const autoLayout = () => {
  saveHistorySnapshot();

  console.log("🔍 Running autoLayout...");
  // 🧹 Step 1: Remove disconnected group nodes
let cleanedNodes = filterLetteredNodes(nodes);
cleanedNodes = filterDisconnectedNodes(cleanedNodes, edges);
setNodes(cleanedNodes);


  console.log("🧹 Cleaned nodes count:", cleanedNodes.length);

  // 🧩 Step 2: Recompute layout using Dagre
  const layoutedNodes = getLayoutedNodes(cleanedNodes, edges);
  console.log("📐 Layout complete:", layoutedNodes.length, "nodes");

  // 🧱 Step 3: Update ReactFlow state
  setNodes(layoutedNodes);

  // 🧭 Step 4: Fit view
 if (reactFlowInstance) {
  setTimeout(() => {
    reactFlowInstance.fitView({ padding: 0.3, duration: 800 });
    console.log("🎯 Auto layout fitView completed.");
  }, 300);
}

};




  // === Save Flow to Backend ===
const saveFlowToBackend = useCallback(async () => {
  if (!scenarioTitle) return alert("Please enter a scenario title!");
  if (!nodes.length) return alert("No nodes to save!");

// ⚠️ Validation: Detect unlinked option nodes
const openOptions = nodes.filter(
  (n) =>
    n.type === "option" &&
    (!n.data?.next || !edges.some((e) => e.source === n.id))
);

if (openOptions.length > 0) {
  const ids = openOptions.map((n) => n.id).join(", ");
  alert(`⚠️ ${openOptions.length} option node(s) are unlinked: ${ids}\nSaving anyway.`);
  // ❌ don't return — continue saving after showing warning
}

  const cleanedNodes = filterDisconnectedNodes(nodes, edges);
 const preferredStart =
  cleanedNodes.find((n) => n.id === "101")?.id ||
  cleanedNodes.find((n) => n.id === "start")?.id ||
  cleanedNodes[0]?.id ||
  null;

    const payload = {
      id: scenarioId,
      title: scenarioTitle,
      nodes: nodesForBackend,
      edges,
      startNodeId: nodes[0]?.id || null,
      status: "Edit",
    };

    try {
      const res = await fetch("http://127.0.0.1:5000/scenarios/saveFlow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.scenarioId) setScenarioId(data.scenarioId);

      localStorage.setItem("latestFlow", JSON.stringify(payload));
      alert("✅ Flow saved successfully!");
      return payload;
    } catch (err) {
      console.error("Save error:", err);
      alert("⚠️ Error saving flow: " + err.message);
      return null;
    }
  }, [nodes, edges, scenarioTitle, scenarioId]);
const [saving, setSaving] = useState(false);

const handleSaveClick = async () => {
  setSaving(true);
  await saveFlowToBackend();
  setSaving(false);
};

  // === Generate AI Images ===
 const generateImages = async () => {
  if (!reactFlowInstance) return;
  if (!nodes.length) return alert("No nodes to generate images for!");

  setLoadingImages(true);
setImageProgress(0);

// Simulate gradual progress while waiting
let progressInterval = setInterval(() => {
  setImageProgress((prev) => {
    if (prev < 95) return prev + Math.random() * 5;
    return prev;
  });
}, 500);


  try {
    // Step 0: Save flow first
    const savedFlow = await saveFlowToBackend();
    if (!savedFlow) throw new Error("Failed to save before generating images.");

    const layoutedNodes = getLayoutedNodes(savedFlow.nodes, savedFlow.edges);

    // ✅ Step 1: Only send nodes missing images
    const nodesForApi = layoutedNodes.filter(
      (n) => !n.data?.b64image
    ).map((n) => ({
      id: n.id,
      data_description: n.data?.data_description || n.data?.scene || "",
    }));

    if (nodesForApi.length === 0) {
      alert("All nodes already have images — nothing to generate!");
      setLoadingImages(false);
      return;
    }

    // Step 2: Generate images
    const res = await fetch("http://127.0.0.1:5000/generate_images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmp: true, nodes: nodesForApi }),
    });

    const data = await res.json();
    if (!res.ok || !data.images?.length) throw new Error(data.error || "No images returned");

    // Step 3: Merge AI images back into nodes
    const newNodes = layoutedNodes.map((n) => {
      const match = data.images.find((img) => img.id === n.id);
      const imageUrl = match ? `data:image/png;base64,${match.image_b64}` : n.data?.b64image || "";
      return {
        ...n,
        data: { ...n.data, imageUrl, b64image: match?.image_b64 || n.data?.b64image || "" },
      };
    });

    // Step 4: Navigate to SceneEditor with updated nodes
    navigate("/scene-editor", { state: { flowData: { ...savedFlow, nodes: newNodes } } });

  } catch (err) {
    console.error("Error generating images:", err);
   if (err.message.includes("GEMINI_API_KEY")) {
  alert("Gemini API key not set. Please configure your .env file.");
} else if (err.message.includes("Failed to save")) {
  alert("Cannot generate images — flow was not saved successfully.");
} else {
  alert("⚠️ Image generation failed. Please check the console for details.");
}

  } finally {
    setLoadingImages(false);
    clearInterval(progressInterval);
  setImageProgress(100);
  setTimeout(() => {
    setLoadingImages(false);
    setImageProgress(0);
  }, 800);
  }
};

  // === Initial Load ===
  useEffect(() => {
    if (!backendFlow) {
      const initNodes = Object.values(sampleNodes).map(standardizeNodeData);
      const initEdges = sampleEdges?.length ? sampleEdges : generateEdgesFromNodes(initNodes);
      setNodes(getLayoutedNodes(initNodes, initEdges));
      setEdges(initEdges);
      return;
    }

    const stdNodes = backendFlow.nodes.map(standardizeNodeData);
    const edges = backendFlow.edges || generateEdgesFromNodes(stdNodes);
    setNodes(getLayoutedNodes(stdNodes, edges));
    setEdges(edges);
    if (backendFlow.id) setScenarioId(backendFlow.id);

    const t = setTimeout(() => reactFlowInstance?.fitView(), 100);
    return () => clearTimeout(t);
  }, [backendFlow, reactFlowInstance]);

  return (
    <div className="flow-chart-editor-container">
      <NavigationBar />
      <div className="editor-container">
        <div className="header">
          <SharedHeader
            profileImage={profileImage}
            userName="Prof Andy"
            userRole="Administrator"
          />
        </div>

        <div className="edit-container">
          <div className="tools-sidebar">
            <EditorToolsSidebar
              scenarioTitle={scenarioTitle}
              setScenarioTitle={setScenarioTitle}
              suggestions={sampleAiSuggestions}
            />
          </div>

          <div ref={reactFlowWrapper} className="main-editor-area">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodesWithHandlers}
                edges={edges}
                nodeTypes={nodeTypesConfig}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                onInit={setReactFlowInstance}
                fitView
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                defaultEdgeOptions={{
                  animated: true,
                  type: "smoothstep",
                  updatable: true,
                }}
                deleteKeyCode={[46, 8]}
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>

              <div className="button-container">
                <button className="action-buttons" onClick={autoLayout}>
                  Auto Layout
                </button>
                <button className='action-buttons' disabled={saving} onClick={handleSaveClick}>
  {saving ? "Saving..." : "Save Flow"}
</button>

                <button className="action-buttons" onClick={generateImages}>
                  Generate Images
                </button>
              </div>
            </ReactFlowProvider>
          </div>
        </div>
      </div>
  {loadingImages && (
  <div className="loading-overlay">
    <div className="loading-box">
      <div className="spinner"></div>

      {isGenerating ? (
        <>
          <p>🎨 Generating AI images...</p>
          <p>
            {generationProgress.current} / {generationProgress.total} nodes completed
          </p>
          <div
            style={{
              width: "80%",
              height: "10px",
              background: "#333",
              borderRadius: "5px",
              marginTop: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${
                  (generationProgress.current / (generationProgress.total || 1)) * 100
                }%`,
                height: "100%",
                background: "#00bfff",
                transition: "width 0.5s ease",
              }}
            ></div>
          </div>
          <small>This may take 2-4 minutes depending on the number of nodes.</small>
        </>
      ) : (
        <>
          <p>💾 Saving your flow...</p>
          <small>Please wait a moment.</small>
        </>
      )}
    </div>
  </div>
)}

</div>
  );
};

export default FlowChartEditor;
