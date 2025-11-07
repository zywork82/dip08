// src/pages/FlowChartEditor.jsx
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

// === DAGRE layout setup ===
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

// === Main Component ===
const FlowChartEditor = () => {
const reactFlowWrapper = useRef(null);
const [reactFlowInstance, setReactFlowInstance] = useState(null);
const [nodes, setNodes] = useState([]);
const [edges, setEdges] = useState([]);
const [isSaving, setIsSaving] = useState(false);
const [isGenerating, setIsGenerating] = useState(false);
const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
const [scenarioId, setScenarioId] = useState(null);
const [scenarioTitle, setScenarioTitle] = useState("Untitled Scenario");
const [traceMode, setTraceMode] = useState(true);
const [selectedNodeId, setSelectedNodeId] = useState(null);
const [debugOpen, setDebugOpen] = useState(false);
const navigate = useNavigate();
const location = useLocation();
const backendFlow = location.state?.flowData;
const passedFlow = location.state?.flowData || null;
// const initialScenarioTitle = location.state?.scenarioTitle || "Untitled Scenario";
// const initialScenarioId =
//   location.state?.scenarioId || localStorage.getItem("lastScenarioId") || null;

useEffect(() => {
    const { scenarioId: navScenarioId, title: navTitle } = location.state || {};

    if (!navScenarioId) return;

    console.log("📥 Fetching scenario for ID:", navScenarioId);

    // Clear previous scenario before fetching new one
    setScenarioId(null);
    setScenarioTitle("Loading...");
    setNodes([]);
    setEdges([]);

    fetch(`http://127.0.0.1:5000/scenarios/getFlow/${navScenarioId}`)
      .then((res) => res.json())
      .then((data) => {
        setScenarioId(data.id);
        setScenarioTitle(data.title || "Untitled Scenario");
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch scenario:", err);
        setScenarioTitle("Failed to load");
      });
  }, [location]); // 🔑 reruns every time location changes
  
  // === Undo/Redo history ===
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const saveHistorySnapshot = useCallback(() => {
    setHistory((prev) => {
      const newSnapshot = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      const updated = [...prev, newSnapshot].slice(-20);
      return updated;
    });
    setRedoStack([]); // clear redo stack on new change
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (history.length > 0) {
      const last = history[history.length - 1];
      setRedoStack((r) => [
        ...r,
        { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) },
      ]);
      setNodes(last.nodes);
      setEdges(last.edges);
      setHistory((h) => h.slice(0, -1));
      console.log("↩️ Undo executed");
    }
  }, [history, nodes, edges]);

  const redo = useCallback(() => {
    if (redoStack.length > 0) {
      const next = redoStack[redoStack.length - 1];
      setHistory((h) => [
        ...h,
        { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) },
      ]);
      setNodes(next.nodes);
      setEdges(next.edges);
      setRedoStack((r) => r.slice(0, -1));
      console.log("🔁 Redo executed");
    }
  }, [redoStack, nodes, edges]);

  useEffect(() => {
    const handleKey = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (ctrl && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (ctrl && (e.key === "y" || (isMac && e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo]);



  // === Duplicate check ===
  useEffect(() => {
    const duplicates = findDuplicateDescriptions(nodes);
    if (duplicates.length > 0) console.warn("⚠️ Duplicate nodes detected:", duplicates);
  }, [nodes]);

  // === Node Deletion ===
  const removeNode = useCallback(
    (nodeId) => {
      saveHistorySnapshot();
      console.log("🗑️ Deleting node:", nodeId);
      setNodes((nds) =>
        nds
          .filter((n) => n.id !== nodeId)
          .map((n) => ({
            ...n,
            data: {
              ...n.data,
              options: (n.data.options || []).filter((o) => o !== nodeId),
              next: n.data.next === nodeId ? null : n.data.next,
            },
          }))
      );
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [saveHistorySnapshot]
  );

  // === ReactFlow handlers ===
  const onNodesChange = useCallback(
    (changes) => {
      saveHistorySnapshot();
      setNodes((nds) =>
        applyNodeChanges(changes, nds).map((n) => ({
          ...n,
          data: { ...nds.find((x) => x.id === n.id)?.data },
        }))
      );
    },
    [saveHistorySnapshot]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      saveHistorySnapshot();
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [saveHistorySnapshot]
  );

  const onConnect = useCallback(
    (connection) => {
      saveHistorySnapshot();
      setEdges((eds) =>
        Array.from(
          new Map(
            addEdge({ ...connection, type: "smoothstep", animated: true }, eds).map((e) => [e.id, e])
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
    },
    [saveHistorySnapshot]
  );

  const onEdgeClick = useCallback(
    (_, edge) => {
      saveHistorySnapshot();
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [saveHistorySnapshot]
  );

  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    console.group("🧭 Node Trace Info");
    console.log("Node ID:", node.id);
    console.log("Type:", node.type);
    console.log("Label:", node.data?.data_description || "(no description)");
    console.log("Options:", node.data?.options || []);
    console.log("Next:", node.data?.next || null);
    console.groupEnd();
  }, []);

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
      const id = `${data.nodeType}_${Math.random().toString(36).substr(2, 6)}_${Date.now()}`;
      saveHistorySnapshot();
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
    [reactFlowInstance, saveHistorySnapshot]
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
  nodes: cleanedNodes,
  edges,
  startNodeId: preferredStart,
  status: "Edit",
};

  try {
    setIsSaving(true);
    const res = await fetch("http://127.0.0.1:5000/scenarios/saveFlow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (data.scenarioId) setScenarioId(data.scenarioId);

    localStorage.setItem("latestFlow", JSON.stringify(payload));
    console.log("✅ Flow saved successfully!");
    return payload;
  } catch (err) {
    console.error("Save error:", err);
    alert("⚠️ Error saving flow: " + err.message);
    return null;
  } finally {
    setIsSaving(false);
  }
}, [nodes, edges, scenarioTitle, scenarioId]);

// === Initial Load ===
useEffect(() => {
  const loadFlow = async () => {
    try {
      // 🧠 Determine source of truth
      const flowFromState = passedFlow || backendFlow;
      const currentScenarioId =
        scenarioId || backendFlow?.id || localStorage.getItem("lastScenarioId");

      // ✅ Case 1: Flow passed from navigation (switch editor)
      if (flowFromState) {
        console.log("🎯 Loading flow from state for scenario:", currentScenarioId);

        const stdNodes = flowFromState.nodes.map(standardizeNodeData);
        const rawEdges = flowFromState.edges || generateEdgesFromNodes(stdNodes);

        let cleanedNodes = filterLetteredNodes(stdNodes);
        cleanedNodes = filterDisconnectedNodes(cleanedNodes, rawEdges);

        const cleanedEdges = rawEdges.filter(
          (e) =>
            cleanedNodes.some((n) => n.id === e.source) &&
            cleanedNodes.some((n) => n.id === e.target)
        );

        const layoutedNodes = getLayoutedNodes(cleanedNodes, cleanedEdges);
        setNodes(layoutedNodes);
        setEdges(cleanedEdges);

        if (currentScenarioId) setScenarioId(currentScenarioId);
        localStorage.setItem("lastScenarioId", currentScenarioId);
        console.log("✅ Flow loaded from passed state or backend flow");
        return;
      }

      // ✅ Case 2: Try fetching from backend using scenarioId
      if (!flowFromState && currentScenarioId) {
        console.log("🌐 Fetching flow from backend for scenario:", currentScenarioId);
        const res = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${currentScenarioId}`);
        if (!res.ok) throw new Error("Failed to fetch scenario flow");
        const data = await res.json();

        if (data && data.flowData) {
          const stdNodes = data.flowData.nodes.map(standardizeNodeData);
          const rawEdges = data.flowData.edges || generateEdgesFromNodes(stdNodes);
          const layoutedNodes = getLayoutedNodes(stdNodes, rawEdges);
          setNodes(layoutedNodes);
          setEdges(rawEdges);
          setScenarioId(currentScenarioId);
          console.log("✅ Flow loaded from backend");
          return;
        }
      }

      // ✅ Case 3: Fallback sample flow (no data at all)
      console.warn("⚠️ No flow found — loading sample flow");
      const initNodes = Object.values(sampleNodes).map(standardizeNodeData);
      const initEdges = sampleEdges?.length
        ? sampleEdges
        : generateEdgesFromNodes(initNodes);
      setNodes(getLayoutedNodes(initNodes, initEdges));
      setEdges(initEdges);
    } catch (err) {
      console.error("❌ Error during flow load:", err);
    }
  };

  loadFlow();
}, [backendFlow, passedFlow, scenarioId]);


// === Generate AI Images & Go to Scene Editor ===
const generateImages = useCallback(async () => {
  if (!reactFlowInstance) return;
  if (!nodes.length) return alert("No nodes to generate images for!");

  const savedFlow = await saveFlowToBackend();
  if (!savedFlow) return alert("❌ Failed to save before generating images.");

  const layoutedNodes = getLayoutedNodes(savedFlow.nodes, savedFlow.edges);
  const nodesForApi = layoutedNodes
    .filter((n) => !n.data?.b64image)
    .map((n) => ({
      id: n.id,
      data_description: n.data?.data_description || n.data?.scene || "",
    }));

  if (nodesForApi.length === 0) {
    alert("All nodes already have images — nothing to generate!");
    return;
  }

  setIsGenerating(true);
  setGenerationProgress({ current: 0, total: nodesForApi.length });

  // 💫 Simulate smooth progress while waiting for response
  let fakeProgress = 0;
  const fakeInterval = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + Math.random() * 0.2, 0.9);
    setGenerationProgress((p) => ({
      ...p,
      current: Math.floor(p.total * fakeProgress),
    }));
  }, 1000);

  try {
    const res = await fetch("http://127.0.0.1:5000/generate_images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: nodesForApi }),
    });

    const data = await res.json();
    clearInterval(fakeInterval);

    if (!res.ok || !data.images?.length)
      throw new Error(data.error || "No images returned");

    // ✅ All done
    setGenerationProgress({ current: nodesForApi.length, total: nodesForApi.length });

    const newNodes = layoutedNodes.map((n) => {
      const match = data.images.find((img) => img.id === n.id);
      const imageUrl = match
        ? `data:image/png;base64,${match.image_b64}`
        : n.data?.b64image || "";
      return {
        ...n,
        data: { ...n.data, imageUrl, b64image: match?.image_b64 || n.data?.b64image || "" },
      };
    });

    const sanitizedNodes = newNodes.map((n) => ({
      ...n,
      data: Object.fromEntries(
        Object.entries(n.data || {}).filter(([_, v]) => typeof v !== "function")
      ),
    }));

    // Slight delay so user sees 100% before navigation
    setTimeout(() => {
      navigate("/scene-editor", {
        state: { flowData: { ...savedFlow, nodes: sanitizedNodes } },
      });
    }, 800);
  } catch (err) {
    clearInterval(fakeInterval);
    console.error("❌ Error generating images:", err);
    alert("⚠️ Image generation failed. Check console for details.");
  } finally {
    setIsGenerating(false);
  }
}, [nodes, edges, reactFlowInstance, navigate, saveFlowToBackend]);


  const tracedEdges = traceMode
    ? edges.map((e) => ({
        ...e,
        style: { stroke: e.source === selectedNodeId ? "#ff0072" : "#999", strokeWidth: 2 },
      }))
    : edges;


  return (
    <div className="flow-chart-editor-container">
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
           {/* 🧭 Floating Debugger Panel */}
<div
  className="floating-debugger"
  style={{
    position: "fixed",
    top: 0,
    right: debugOpen ? 0 : "-400px", // slide in/out
    width: "400px",
    height: "100%",
    background: "#1e1e1e",
    color: "white",
    transition: "right 0.3s ease",
    padding: "20px",
    overflowY: "auto",
    boxShadow: debugOpen ? "0 0 20px rgba(0,0,0,0.4)" : "none",
    zIndex: 2000,
  }}
>
  <button
    onClick={() => setDebugOpen(false)}
    style={{
      position: "absolute",
      top: "10px",
      right: "0px",
      width: "40px",
      height: "40px",
      borderRadius: "8px 0 0 8px",
      background: "#ff0072",
      color: "white",
      border: "none",
      cursor: "pointer",
    }}
  >
    ✖
  </button>
{/* 🧭 Debugger toggle button */}
<button
  onClick={() => setDebugOpen(true)}
  style={{
    position: "fixed",
    bottom: "100px",
    right: "40px",
    background: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "50%",
    width: "48px",
    height: "48px",
    fontSize: "22px",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
    zIndex: 1500,
  }}
  title="Open Path Debugger"
>
  🧭
</button>

  <h3>🧭 Path Debugger</h3>
  {selectedNodeId ? (
    <div>
      <p><strong>ID:</strong> {selectedNodeId}</p>
      <p>
        <strong>Label:</strong>{" "}
        {nodes.find((n) => n.id === selectedNodeId)?.data?.data_description ||
          "(no description)"}
      </p>
      <p>
        <strong>Type:</strong>{" "}
        {nodes.find((n) => n.id === selectedNodeId)?.type}
      </p>
    </div>
  ) : (
    <p>No node selected</p>
  )}

  <h4>Connections</h4>
  <ul>
    {edges.map((e) => (
      <li key={e.id}>
        {e.source} → {e.target}
      </li>
    ))}
  </ul>

  {/* <button
    onClick={() => setTraceMode((v) => !v)}
    style={{
      marginTop: "10px",
      background: traceMode ? "#ff4d4d" : "#4CAF50",
      border: "none",
      padding: "8px 12px",
      borderRadius: "8px",
      cursor: "pointer",
      color: "white",
    }}
  >
    {traceMode ? "🔴 Disable Trace Mode" : "🧩 Enable Trace Mode"}
  </button> */}
</div>

          </div>

          <div ref={reactFlowWrapper} className="main-editor-area">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes.map((n) => ({
                  ...n,
                  data: {
                    ...n.data,
                    isSelected: n.id === selectedNodeId,
                    onChange: (e) => {
                      saveHistorySnapshot();
                      const value = e.target.value;
                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === n.id
                            ? { ...node, data: { ...node.data, data_description: value } }
                            : node
                        )
                      );
                    },
                    onDelete: () => removeNode(n.id),
                  },
                }))}
                edges={tracedEdges}
                nodeTypes={nodeTypesConfig}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                onNodeClick={onNodeClick}
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

              {/* 🧭 Floating Toolbar */}
              <div
                style={{
                  position: "fixed",
                  bottom: "30px",
                  right: "40px",
                  display: "flex",
                  gap: "10px",
                  background: "rgba(30,30,30,0.8)",
                  padding: "10px 15px",
                  borderRadius: "12px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                }}
              >
                <button
                  onClick={undo}
                  disabled={history.length === 0}
                  style={{
                    background: "#ff4d4d",
                    border: "none",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    cursor: history.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  ↩️ Undo
                </button>
                <button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  style={{
                    background: "#4CAF50",
                    border: "none",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    cursor: redoStack.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  🔁 Redo
                </button>
              </div>

             <div className="button-container">
  <button className="action-buttons" onClick={autoLayout}>
    Auto Layout
  </button>

  <button
    className="action-buttons"
    disabled={isSaving || isGenerating} // disable if either process is running
    onClick={saveFlowToBackend}
  >
    {isSaving ? "Saving..." : "Save Flow"}
  </button>

  <button
    className="action-buttons"
    disabled={isSaving || isGenerating} // disable if saving or generating
    onClick={generateImages}
  >
    {isGenerating ? "Generating..." : "Generate Images"}
  </button><button
      className="action-buttons"
      onClick={() => {
        // ✅ Step 1: Clean the flow so it’s serializable
        const safeFlow = sanitizeFlowForNavigation({ nodes, edges });

        // ✅ Step 2: Save to localStorage for persistence
        localStorage.setItem("latestFlow", JSON.stringify(safeFlow));

        // ✅ Step 3: Navigate to SceneEditor
        navigate("/scene-editor", { state: { scenarioId } });
      }}
    >
      🖼️ Switch to Image Editor
    </button>
</div>



            </ReactFlowProvider>
          </div>
        </div>
      </div>
{(isSaving || isGenerating) && (
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
