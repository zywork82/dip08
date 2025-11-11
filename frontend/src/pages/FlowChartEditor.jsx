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


import localforage from "localforage";
import { getLayoutedNodes, centerSiblings } from "../utils/autoLayout";
// import { saveActiveFlow } from "../utils/sharedCache";
import { normalizeFlow } from "../utils/flowNormaliser";
// import { loadActiveFlow } from "../utils/sharedCache";
import SharedHeader from "../components/SharedHeader";
import NavigationBar from "../components/SlimNavBar";
import { sampleNodes, sampleAiSuggestions, sampleEdges } from "../data/sampleAiFlow";
// import { sanitizeFlowForNavigation } from "../utils/flowSanitiser";
import "../styles/FlowChartEditor.css";

import DebuggerPanel from "../components/DebuggerPanel";

const profileImage =
  "https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg";

const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  ending: NodeWrapper,
  endScenario: NodeWrapper,
};


// === Sanitize flow before saving or navigating ===
const sanitizeFlowForNavigation = (flow) => {
  if (!flow) return null;

  const safeNodes = (flow.nodes || []).map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      data_description: n.data?.data_description || "",
      options: Array.isArray(n.data?.options) ? n.data.options : [],
      next: n.data?.next || null,
      scene: n.data?.scene || "",
      b64image: n.data?.b64image || "",
      generatedImages: Array.isArray(n.data?.generatedImages)
        ? n.data.generatedImages
        : [],
      imageUrl: n.data?.imageUrl || "",
    },
  }));

  const safeEdges = (flow.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type || "smoothstep",
    animated: !!e.animated,
  }));

  return {
    ...flow,
    nodes: safeNodes,
    edges: safeEdges,
  };
};

// === Helpers ===
const generateEdgesFromNodes = (nodes) => {
  const edges = [];
  const nodesCopy = [...nodes];

  // 🧱 Ensure at least one ending node exists
  let endingNode = nodesCopy.find((n) => n.type === "ending");
  if (!endingNode) {
    endingNode = {
      id: `E1`,
      type: "ending",
      position: { x: 0, y: 0 },
      data: { data_description: "Ending", options: [], next: null },
    };
    nodesCopy.push(endingNode);
  }

  // 🧩 Build edges
  nodesCopy.forEach((n) => {
    const d = n.data || {};

    // Scenario → options
    if (n.type === "scenario" && Array.isArray(d.options) && d.options.length > 0) {
      d.options.forEach((optId) => {
        if (nodesCopy.find((x) => x.id === optId)) {
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

    // Option → next (or auto-ending)
    if (n.type === "option") {
      const nextTarget = d.next && nodesCopy.find((x) => x.id === d.next)
        ? d.next
        : endingNode.id; // fallback to ending node

      edges.push({
        id: `e-${n.id}-${nextTarget}`,
        source: n.id,
        target: nextTarget,
        type: "smoothstep",
        animated: true,
      });
    }
  });

  // 🧹 Remove duplicates
  const uniqueEdges = Array.from(new Map(edges.map((e) => [e.id, e])).values());
  return uniqueEdges;
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



// === Keep all meaningful nodes (only remove totally empty or orphaned placeholders) ===
const filterDisconnectedNodes = (nodes, edges) => {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return nodes;

  const filtered = nodes.filter((n) => {
    const id = n.id?.toString() || "";
    const isEndingNode = /^E\d+$/i.test(id);
    const hasDescription = (n.data?.data_description || "").trim().length > 0;
    const hasConnections = edges.some((e) => e.source === id || e.target === id);
    const hasOptions = Array.isArray(n.data?.options) && n.data.options.length > 0;

    // ✅ Keep if it’s an ending, connected, or actually written (non-empty description)
    return isEndingNode || hasConnections || hasOptions || hasDescription;
  });

  const removed = nodes.length - filtered.length;
  if (removed > 0) console.log(`🧹 Removed ${removed} disconnected node(s)`);

  return filtered;
};




// // === Duplicate detection ===
// const findDuplicateDescriptions = (nodes) => {
//   const map = {};
//   nodes.forEach((n) => {
//     const desc = n.data.data_description?.trim();
//     if (!desc) return;
//     map[desc] = map[desc] ? [...map[desc], n.id] : [n.id];
//   });
//   return Object.entries(map)
//     .filter(([_, ids]) => ids.length > 1)
//     .map(([desc, ids]) => ({ desc, ids }));
// };

// === Standardize Node Data ===
const standardizeNodeData = (node) => {
  const d = typeof node.data === "object" ? node.data : { data_description: node.data || "" };
   // Handle case where node is already in correct format
  if (node.data && typeof node.data === 'object') {
    return {
      ...node,
      data: {
        data_description: node.data.data_description || "",
        options: node.data.options || [],
        next: node.data.next || null,
        scene: node.data.scene || "",
        b64image: node.data.b64image || "",
        generatedImages: node.data.generatedImages || [],
        imageUrl: node.data.imageUrl || "",
        loadingImages: false,
      },
    };
  }
  
  // Handle flat object format from backend
    return {
      id: node.id,
      type: node.type || "scenario",
      position: node.position || { x: 0, y: 0 },
      data: {
        data_description: node.data_description || "",
        options: node.options || [],
        next: node.next || null,
        scene: node.scene || "",
        b64image: node.b64image || "",
        generatedImages: [],
        imageUrl: "",
        loadingImages: false,
      },
    };

};

// === Main Component ===
const FlowChartEditor = () => { 
  const navigate = useNavigate();
  const location = useLocation();
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const initialScenarioId = location.state?.scenarioId || location.state?.flowData?._id ||localStorage.getItem("lastScenarioId") || null;
  const [scenarioId, setScenarioId] = useState(initialScenarioId);
  // ✅ Extract from navigation state FIRST
const passedFlow = location.state?.flowData || null;
const passedScenarioId = location.state?.scenarioId || null;
const passedScenarioTitle = location.state?.scenarioTitle || "Untitled Scenario";

  const [traceMode] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);

 

  // // ✅ Extract from navigation state FIRST
  // const passedFlow = location.state?.flowData || null;
  // const passedScenarioId = location.state?.scenarioId || null;
  // const passedScenarioTitle = location.state?.scenarioTitle || "Untitled Scenario";

  // ✅ Then safely initialize your state using those
  const [scenarioTitle, setScenarioTitle] = useState(passedScenarioTitle);
  const [scenarioIdState, setScenarioIdState] = useState(passedScenarioId);

  // You can also use backendFlow if you like:
  const backendFlow = passedFlow;

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
// useEffect(() => {
//   (async () => {
//     const cached = await loadActiveFlow();
//     if (cached) {
//       setScenarioId(cached.scenarioId || null);
//       setNodes(cached.flowData.nodes || []);
//       setEdges(cached.flowData.edges || []);
//       console.log("🔁 Restored flow from shared cache");
//     }
//   })();
// }, []);
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

// 🩵 Guarantee scenarioId persistence between reloads and navigation
useEffect(() => {
  if (scenarioId) {
    localStorage.setItem("lastScenarioId", scenarioId);
    console.log("💾 Cached scenarioId:", scenarioId);
  } else {
    const fallbackId = localStorage.getItem("lastScenarioId");
    if (fallbackId) {
      setScenarioId(fallbackId);
      console.log("♻️ Restored scenarioId from localStorage:", fallbackId);
    }
  }
}, [scenarioId]);


  // // === Duplicate check ===
  // useEffect(() => {
  //   const duplicates = findDuplicateDescriptions(nodes);
  //   if (duplicates.length > 0) console.warn("⚠️ Duplicate nodes detected:", duplicates);
  // }, [nodes]);

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
  console.log("🧭 Running Dagre Auto Layout...");

  // 🧹 Filter & clean first
  let cleanedNodes = filterLetteredNodes(nodes);
  cleanedNodes = filterDisconnectedNodes(cleanedNodes, edges);

 
  // 🧩 Apply layout and center siblings
  let layoutedNodes = getLayoutedNodes(cleanedNodes, edges);
  layoutedNodes = centerSiblings(layoutedNodes, edges);
  setNodes(layoutedNodes);


  // ✅ Optional: auto-fit view after layout
  if (reactFlowInstance) {
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.3, duration: 800 });
      console.log("🎯 Auto layout fitView completed.");
    }, 300);
  }

  console.log(`📐 Layout complete — positioned ${layoutedNodes.length} nodes.`);
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
    console.log("📦 Nodes before filter:", nodes.length);
const cleanedNodes = filterDisconnectedNodes(nodes, edges);
console.log("📦 Nodes after filter:", cleanedNodes.length);
console.log("🚀 Sending payload to backend:");
console.log(JSON.stringify(payload, null, 2));

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

// // === Initial Load ===
// useEffect(() => {
//   const loadFlow = async () => {
//     try {
//       const passedFlow = location.state?.flowData || null;

//       console.log("🎯 Loading flow - scenarioId:", scenarioId);
//       console.log("🎯 passedFlow:", passedFlow ? "Object" : "null");

//      // 1) Highest priority: flow passed via navigation
// if (passedFlow) {
//   const hasNodes =
//     Array.isArray(passedFlow.nodes) ||
//     (passedFlow.nodes && Object.keys(passedFlow.nodes).length > 0);

//   if (hasNodes) {
//     console.log("✅ Passed flow contains nodes — normalizing directly.");
//     const flow = normalizeFlow(passedFlow);
//     setNodes(getLayoutedNodes(flow.nodes, flow.edges));
//     setEdges(flow.edges);
//     if (flow.id) setScenarioId(flow.id);
//     return;
//   } else {
//     console.warn("⚠️ Passed flow has no nodes — will fetch full flow from backend instead.");
//   }
// }

//       // 2) Next: fetch from backend using scenarioId
//       if (scenarioId) {
//         const res = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${scenarioId}`);
//         if (!res.ok) throw new Error(`Backend fetch failed: ${res.status}`);
//         const data = await res.json();

//         const flow = normalizeFlow(data, {
//           defaultType: "scenario",
//           typeAlias: { endScenario: "ending" },
//         });

//         setNodes(getLayoutedNodes(flow.nodes, flow.edges));
//         setEdges(flow.edges);
//         console.log("✅ Loaded from backend:", flow.nodes.length, "nodes");
//         return;
//       }

//       // 3) Fallback: IndexedDB (localforage)
//       const cached = await localforage.getItem("latestFlow");
//       if (cached) {
//         const flow = normalizeFlow(cached, {
//           defaultType: "scenario",
//           typeAlias: { endScenario: "ending" },
//         });

//         setNodes(getLayoutedNodes(flow.nodes, flow.edges));
//         setEdges(flow.edges);
//         console.log("✅ Loaded from IndexedDB:", flow.nodes.length, "nodes");
//         return;
//       }

//       // 4) Final fallback: samples
//       console.warn("⚠️ No flow found — loading sample flow");
//       const sampleFlow = normalizeFlow(
//         { nodes: Object.values(sampleNodes), edges: sampleEdges },
//         { defaultType: "scenario", typeAlias: { endScenario: "ending" } }
//       );
//       setNodes(getLayoutedNodes(sampleFlow.nodes, sampleFlow.edges));
//       setEdges(sampleFlow.edges);
//     } catch (err) {
//       console.error("❌ Error during flow load:", err);
//       // safe fallback: samples
//       const sampleFlow = normalizeFlow(
//         { nodes: Object.values(sampleNodes), edges: sampleEdges },
//         { defaultType: "scenario", typeAlias: { endScenario: "ending" } }
//       );
//       setNodes(getLayoutedNodes(sampleFlow.nodes, sampleFlow.edges));
//       setEdges(sampleFlow.edges);
//     }
//   };

//   loadFlow();
//   // eslint-disable-next-line react-hooks/exhaustive-deps
// }, []); 


useEffect(() => {
  const loadFlow = async () => {
    try {
       const currentScenarioId =    scenarioId || location.state?.flowData?._id || localStorage.getItem("lastScenarioId");
console.log("🎯 Loading flow - scenarioId:", currentScenarioId);
 console.log("🎯 passedFlow:", passedFlow);
console.log("🎯 backendFlow:", backendFlow);
      // ✅ Priority 1: Use passed flow from navigation
      if (passedFlow) {
        console.log("✅ Loading from passedFlow");
        const stdNodes = Array.isArray(passedFlow.nodes) 
          ? passedFlow.nodes 
          : Object.values(passedFlow).filter(n => n.id); // Handle object format
        
        const normalizedNodes = stdNodes.map(standardizeNodeData);
        const rawEdges = passedFlow.edges || generateEdgesFromNodes(normalizedNodes);
        
        const layoutedNodes = getLayoutedNodes(normalizedNodes, rawEdges);
        setNodes(layoutedNodes);
        setEdges(rawEdges);
        
        console.log("✅ Loaded nodes:", layoutedNodes.length);
        console.log("✅ Loaded edges:", rawEdges.length);
        return;
      }

      // ✅ Priority 2: Fetch from backend if scenarioId exists
      if (currentScenarioId) {      console.log("🌐 Fetching from backend:", currentScenarioId);  const res = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${currentScenarioId}`);
        
        if (!res.ok) {
          console.error("❌ Backend fetch failed:", res.status);
          throw new Error("Failed to fetch scenario flow");
        }
        
        const data = await res.json();
        console.log("✅ Backend data received:", data);

        // Handle both array and object formats
        const nodesData = Array.isArray(data.nodes) 
          ? data.nodes 
          : Object.values(data.nodes || data);
        
        const stdNodes = nodesData
          .filter(n => n && n.id) // Remove null/undefined entries
          .map(standardizeNodeData);
        
        const rawEdges = data.edges || generateEdgesFromNodes(stdNodes);
        const layoutedNodes = getLayoutedNodes(stdNodes, rawEdges);
        
        setNodes(layoutedNodes);
        setEdges(rawEdges);
        
        console.log("✅ Loaded from backend - nodes:", layoutedNodes.length);
        return;
      }

      // ✅ Priority 3: Try IndexedDB (localforage)

      
const cachedFlow = await localforage.getItem("latestFlow");
if (cachedFlow) {
  console.log("📦 Loading from IndexedDB (latestFlow)");

  const nodesData = Array.isArray(cachedFlow.nodes)
    ? cachedFlow.nodes
    : Object.values(cachedFlow.nodes || cachedFlow);

  const stdNodes = nodesData
    .filter((n) => n && n.id)
    .map(standardizeNodeData);

  const rawEdges = cachedFlow.edges || generateEdgesFromNodes(stdNodes);
  const layoutedNodes = getLayoutedNodes(stdNodes, rawEdges);

  setNodes(layoutedNodes);
  setEdges(rawEdges);

  console.log("✅ Loaded from IndexedDB - nodes:", layoutedNodes.length);
  return;
}



      // ✅ Priority 4: Fallback to sample flow
      console.warn("⚠️ No flow found - loading sample flow");
      const initNodes = Object.values(sampleNodes).map(standardizeNodeData);
      const initEdges = sampleEdges?.length ? sampleEdges : generateEdgesFromNodes(initNodes);
      
      const layoutedNodes = getLayoutedNodes(initNodes, initEdges);
      setNodes(layoutedNodes);
      setEdges(initEdges);
      
      console.log("✅ Loaded sample flow - nodes:", layoutedNodes.length);

    } catch (err) {
      console.error("❌ Error during flow load:", err);
      
      // Fallback to sample on error
      const initNodes = Object.values(sampleNodes).map(standardizeNodeData);
      const initEdges = sampleEdges?.length ? sampleEdges : generateEdgesFromNodes(initNodes);
      setNodes(getLayoutedNodes(initNodes, initEdges));
      setEdges(initEdges);
    }
  };

  loadFlow();
}, []); 


// === Auto-center & cinematic zoom (ONLY on initial load) ===
const hasInitialZoomRef = useRef(false); // ✅ Add this ref at the top with other refs

useEffect(() => {
  if (!reactFlowInstance || !nodes.length) return;
  
  // ✅ Skip if we've already done initial zoom
  if (hasInitialZoomRef.current) return;
  
  // Mark as done
  hasInitialZoomRef.current = true;

  const startNodeId = passedFlow?.startNodeId || "101";
  const startNode = nodes.find(n => n.id === startNodeId);

  // Step 1: focus the start node
  if (startNode) {
    reactFlowInstance.fitView({ nodes: [startNode], padding: 0.5, duration: 600 });
  }

  // Step 2: after a short delay, show the whole flow
  setTimeout(() => {
    reactFlowInstance.fitView({ padding: 0.3, duration: 800 });
    console.log("🎯 Initial layout fitView completed.");
  }, 1000);
}, [reactFlowInstance, nodes]); // Keep dependencies but use ref to control execution

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

    // const newNodes = layoutedNodes.map((n) => {
    //   const match = data.images.find((img) => img.id === n.id);
    //   const imageUrl = match
    //     ? `data:image/png;base64,${match.image_b64}`
    //     : n.data?.b64image || "";
    //   return {
    //     ...n,
    //     data: { ...n.data, imageUrl, b64image: match?.image_b64 || n.data?.b64image || "" },
    //   };
    // });
const newNodes = await Promise.all(
  layoutedNodes.map(async (n) => {
    const match = data.images.find((img) => img.id === n.id);
    if (!match) return n;

    const b64 = match.image_b64;
    if (!b64) return n;

    // 🖼️ Upload to temp storage
    try {
      const uploadRes = await fetch("http://127.0.0.1:5000/scenarios/uploadTempImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: n.id,
          b64image: `data:image/png;base64,${b64}`,
        }),
      });
      const uploadData = await uploadRes.json();
      const imageUrl = `http://127.0.0.1:5000${uploadData.url}`;

      return {
        ...n,
        data: {
          ...n.data,
          imageUrl,
          b64image: "", // 🧹 remove inline base64 to save space
        },
      };
    } catch (e) {
      console.error(`❌ Temp upload failed for ${n.id}:`, e);
      return n;
    }
  })
);

    const sanitizedNodes = newNodes.map((n) => ({
      ...n,
      data: Object.fromEntries(
        Object.entries(n.data || {}).filter(([_, v]) => typeof v !== "function")
      ),
    }));
// await saveActiveFlow({ scenarioId, flowData: { ...savedFlow, nodes: sanitizedNodes } });
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
<DebuggerPanel
  debugOpen={debugOpen}
  setDebugOpen={setDebugOpen}
  selectedNodeId={selectedNodeId}
  nodes={nodes}
  edges={edges}
/>
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
