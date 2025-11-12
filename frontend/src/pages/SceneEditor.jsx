// src/pages/SceneEditor.jsx


import React, { useState, useEffect, useCallback, useRef } from "react";
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
import {
  convertFrontendToBackend,
  convertBackendToFrontend,
} from "../utils/flowConverter";
import localforage from "localforage";
import { getLayoutedNodes, centerSiblings } from "../utils/autoLayout";
import "reactflow/dist/style.css";
import "../styles/SceneEditor.css";

// ===============================
// Flags / guards
// ===============================
let GEMINI_QUOTA_EXCEEDED = false;
let stopGeneration = false;
let AUTO_GEN_RUNNING = false;

// ===============================
// Cache (lightweight)
// ===============================
const CACHE_KEY = "sceneEditorCache_v1";

// ✅ Save lightweight node info (URL + small metadata)
const saveNodesToCache = async (nodes) => {
  try {
    const simplified = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        data_description: n.data?.data_description || "",
        imageUrl: n.data?.imageUrl || "",
        generatedImages: (n.data?.generatedImages || []).slice(0, 3),
      },
    }));
    await localforage.setItem(CACHE_KEY, simplified);
    console.log(`💾 Cached ${simplified.length} image URLs.`);
  } catch (err) {
    console.warn("⚠️ Failed to cache nodes:", err);
  }
};

const loadNodesFromCache = async () => {
  try {
    const cached = await localforage.getItem(CACHE_KEY);
    return Array.isArray(cached) ? cached : [];
  } catch (err) {
    console.warn("⚠️ Failed to load cache:", err);
    return [];
  }
};

// ===============================
// Backend helpers
// ===============================
async function updateScenarioStatus(scenarioId, newStatus) {
  try {
    const res = await fetch(
      `http://127.0.0.1:5000/scenarios/updateStatus/${scenarioId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update status");
    console.log(`🟢 Scenario ${scenarioId} status → ${newStatus}`);
    return true;
  } catch (err) {
    console.error("❌ Failed to update scenario status:", err);
    return false;
  }
}
// ===============================
// Upload temp image helper (b64 → file URL)
// ===============================
async function uploadTempImage(node, scenarioId) {
  if (!node?.data?.b64image) return;

  try {
    const res = await fetch("http://127.0.0.1:5000/scenarios/uploadTempImage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: node.id,
        scenario_id: scenarioId,
        b64image: node.data.b64image,
      }),
    });

    const data = await res.json();

    if (data.success) {
      const fullUrl = data.url.startsWith("http")
        ? data.url
        : `http://127.0.0.1:5000${data.url}`;
      node.data.imageUrl = fullUrl;
      node.data.b64image = ""; // ✅ remove heavy base64
      console.log(`🖼️ Uploaded temp image for node ${node.id} → ${fullUrl}`);
      return fullUrl;
    } else {
      console.error("❌ Upload failed:", data.error);
    }
  } catch (err) {
    console.error(`❌ uploadTempImage error for node ${node.id}:`, err);
  }
}

// ===============================
// Validators / utilities
// ===============================
const hasValidImage = (node) => {
  const url = node.data?.imageUrl || "";
  const b64 = node.data?.b64image || "";

  if (!url && !b64) return false;
  if (
    url.includes("placehold") ||
    url.includes("placeholder") ||
    url.includes("dummyimage") ||
    url.startsWith("blob:") ||
    (url.startsWith("data:image") && url.length < 300) ||
    (b64 && b64.length < 300)
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
      imageUrl: n.data?.imageUrl || "",
    },
  }));
  return { nodes: lightNodes, edges };
};

const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  ending: NodeWrapper,
};

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
    failedImage: node.data?.failedImage || false,
  },
});

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

  // persist scenarioId
  useEffect(() => {
    if (scenarioId) {
      localStorage.setItem("lastScenarioId", scenarioId);
      localforage.setItem("lastScenarioId", scenarioId).catch(() => {});
      console.log("💾 SceneEditor cached scenarioId:", scenarioId);
    } else {
      const fallbackId =
        localStorage.getItem("lastScenarioId") ||
        null;
      if (fallbackId) {
        setScenarioId(fallbackId);
        console.log("♻️ Restored scenarioId:", fallbackId);
      }
    }
  }, [scenarioId]);

  useEffect(() => {
    (async () => {
      if (scenarioId) return;
      const storedScenarioId = await localforage.getItem("lastScenarioId");
      if (storedScenarioId) setScenarioId(storedScenarioId);
    })();
  }, []);

  // ✅ Restore saved scenario title (so it persists across reloads)
useEffect(() => {
  (async () => {
    const cachedTitle = await localforage.getItem("lastScenarioTitle");
    if (cachedTitle) {
      setScenarioTitle(cachedTitle);
      console.log("♻️ Restored scenarioTitle:", cachedTitle);
    }
  })();
}, []);


  // Fetch full scenario from backend (authoritative)
  useEffect(() => {
    const fetchScenarioFromBackend = async () => {
      try {
        const idToLoad =
          location.state?.scenarioId ||
          scenarioId ||
          localStorage.getItem("lastScenarioId");

        if (!idToLoad || !/^[0-9a-fA-F]{24}$/.test(idToLoad)) {
          console.warn("⚠️ Invalid or missing scenarioId — skipping fetch");
          return;
        }

        console.log(`🌐 Fetching full scenario: ${idToLoad}`);
        const res = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${idToLoad}`);
        if (!res.ok) throw new Error("Failed to fetch scenario");

        const data = await res.json();
        if (!data.nodes) {
          console.warn("⚠️ No nodes in backend scenario");
          return;
        }

        const frontendFlow = convertBackendToFrontend(data);
        const standardizedNodes = Object.values(frontendFlow.nodes).map(standardizeNodeData);

        let layoutedNodes = getLayoutedNodes(standardizedNodes, data.edges || []);
        layoutedNodes = centerSiblings(layoutedNodes, data.edges || []);

        setNodes(layoutedNodes);
        setEdges(data.edges || generateEdgesFromNodes(layoutedNodes));
        setScenarioTitle(data.title || "Untitled Scenario");
        await localforage.setItem(
  "lastScenarioTitle",
  data.title || "Untitled Scenario"
);

        console.log("✅ Loaded scenario with images from backend");
      } catch (err) {
        console.error("❌ Failed to fetch scenario:", err);
      }
    };

    fetchScenarioFromBackend();
  }, [passedScenarioId]);

  // Initial load (merge passedFlow + cache, normalize base64 URLs once)
  useEffect(() => {
    (async () => {
      let flowData = passedFlow || (await localforage.getItem("latestFlow"));

      // merge cached URLs
      const cachedNodes = await loadNodesFromCache();
      if (cachedNodes.length > 0 && flowData?.nodes?.length) {
        flowData.nodes = flowData.nodes.map((n) => {
          const cached = cachedNodes.find((c) => c.id === n.id);
          return cached
            ? {
                ...n,
                data: {
                  ...n.data,
                  imageUrl: cached.data.imageUrl || "",
                  generatedImages: cached.data.generatedImages || [],
                },
              }
            : n;
        });
      }

      // Upload leftover inline base64 once → to temp URLs
      const uploadBase64Images = async (nodesIn) => {
        const updated = [];
        const base64Nodes = nodesIn.filter((n) => n.data?.imageUrl?.startsWith("data:image/"));
        const total = base64Nodes.length;
        if (total > 0) console.log(`🧠 Found ${total} base64 images → uploading...`);

        let uploaded = 0;
        for (const node of nodesIn) {
          const imgUrl = node.data?.imageUrl || "";
          if (imgUrl.startsWith("data:image/")) {
            try {
              const res = await fetch("http://127.0.0.1:5000/scenarios/uploadTempImage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ node_id: node.id, b64image: imgUrl }),
              });
              const data = await res.json();
              if (data.success && data.url) {
                const absolute =
                  data.url.startsWith("http")
                    ? data.url
                    : `http://127.0.0.1:5000${data.url}`;
                node.data.imageUrl = absolute;
                uploaded++;
                if (uploaded % 3 === 0 || uploaded === total) {
                  console.log(`📤 Upload Progress ${uploaded}/${total} → ${absolute}`);
                }
              }
            } catch (err) {
              console.warn(`⚠️ Upload failed for node ${node.id}:`, err);
            }
          }
          updated.push(node);
        }
        if (total > 0) console.log(`✅ Converted ${uploaded}/${total} base64 → URLs`);
        return updated;
      };

      if (flowData?.nodes?.length > 0) {
        flowData.nodes = await uploadBase64Images(flowData.nodes);
      }

      if (!flowData) return;
      if (!flowData.nodes) {
        flowData = {
          nodes: Object.values(convertBackendToFrontend(flowData)),
          edges: [],
        };
      }

      const standardizedNodes = flowData.nodes.map(standardizeNodeData);
      const layoutedNodes = getLayoutedNodes(standardizedNodes, flowData.edges || []);
      const edgesGenerated = flowData.edges || generateEdgesFromNodes(layoutedNodes);

      setNodes(layoutedNodes);
      setEdges(edgesGenerated);

      // auto-generate missing images (one guarded pass)
      const totalNodes = layoutedNodes.length;
      const missing = layoutedNodes.filter(
        (n) => ["scenario", "ending"].includes(n.type) && !hasValidImage(n)
      );

      console.log(`🧩 Image status: ${totalNodes - missing.length}/${totalNodes} valid.`);
      if (missing.length > 0) {
        console.warn(`🖼️ Auto-generating ${missing.length} missing images...`);
        setLoadingOverlay(true);
        await autoGenerateImagesForAll(missing);
        setLoadingOverlay(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passedFlow]);

  // Periodic retry (single interval, guarded)
  const hasStartedAutoCheck = useRef(false);
  useEffect(() => {
    if (hasStartedAutoCheck.current || !nodes.length) return;
    hasStartedAutoCheck.current = true;

    const checkAndGenerate = async () => {
      const missing = nodes.filter(
        (n) =>
          ["scenario", "ending"].includes(n.type) &&
          (!n.data?.imageUrl || n.data.imageUrl.length < 200) &&
          !n.data.loadingImages &&
          !n.data.failedImage
      );

      if (missing.length > 0 && !AUTO_GEN_RUNNING) {
        console.log(
          `🔁 Auto Image Check → retrying ${missing.length} node(s):`,
          missing.map((m) => m.id)
        );
        await autoGenerateImagesForAll(missing);
      } else if (missing.length === 0) {
        console.log(`✅ Auto Image Check → all nodes valid. Clearing interval.`);
        clearInterval(interval);
      }
    };

    // run once on start + every 30s until complete
    checkAndGenerate();
    const interval = setInterval(checkAndGenerate, 30000);
    console.log("🧠 Auto image regeneration interval started.");

    return () => {
      clearInterval(interval);
      console.log("🧹 Auto image regeneration interval cleared.");
    };
  }, [nodes]);

  // Selection / editing
  const onNodeClick = (_, node) => {
    setSelectedNode(node);
    setPromptText(node.data.data_description || "");
  };
  const onNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));

  // Update prompt text into node
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

  // Debounced lightweight autosave (no base64)
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
        // console.log("✅ Auto-saved lightweight node", selectedNode.id);
      } catch (e) {
        console.warn("⚠️ Skipped auto-save:", e);
      }
    }, 1200);
    return () => clearTimeout(debounce);
  }, [promptText, selectedNode]);

  const handleAutoLayout = () => {
    console.log("🧭 Auto Layout");
    let layouted = getLayoutedNodes(nodes, edges);
    layouted = centerSiblings(layouted, edges);
    setNodes(layouted);
  };

//   // Clean, single reprompt handler
//   const handleReprompt = async (nodeId, prompt) => {
//     if (stopGeneration) return;

//     setNodes((nds) =>
//       nds.map((n) =>
//         n.id === nodeId
//           ? { ...n, data: { ...n.data, loadingImages: true, failedImage: false } }
//           : n
//       )
//     );

//     try {
//       const res = await fetch("http://127.0.0.1:5000/scenarios/updateImage", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ nodeId, description: prompt }),
//       });
//       const data = await res.json();
//       if (!res.ok || !data.images?.length) throw new Error(data.error || "No images");
//       // The backend already returns URLs — use them directly
// // const updatedImages = data.images.map((url) =>
// //   url.startsWith("http")
// //     ? `${url}?t=${Date.now()}`
// //     : `http://127.0.0.1:5000${url}?t=${Date.now()}`
// // );
// // const imageUrl = updatedImages[0];

//   //     const first = data.images[0];
//   //     const imageUrl = await uploadTempImage(
//   // { id: nodeId, data: { b64image: first } },
//   // scenarioId
// //);

//     // ✅ Use all 3 image URLs directly
//     const updatedImages = data.images.map((url) =>
//       url.startsWith("http")
//         ? `${url}?t=${Date.now()}`
//         : `http://127.0.0.1:5000${url}?t=${Date.now()}`
//     );

//     const primary = updatedImages[0];

//       setNodes((nds) =>
//         nds.map((n) =>
//           n.id === nodeId
//             ? {
//                 ...n,
//                 data: {
//                   ...n.data,
//                   imageUrl: primary,
//                   // generatedImages: [imageUrl, ...(n.data.generatedImages || [])].slice(0, 5),
//                    generatedImages: updatedImages,
//                   loadingImages: false,
//                 },
//               }
//             : n
//         )
//       );
//          console.log(`🖼️ Updated node ${nodeId} with ${updatedImages.length} new images`);
//     } catch (err) {
//       console.error("❌ handleReprompt error:", err);
//       setNodes((nds) =>
//         nds.map((n) =>
//           n.id === nodeId
//             ? { ...n, data: { ...n.data, loadingImages: false, failedImage: true } }
//             : n
//         )
//       );
//     }
//   };
const handleReprompt = async (nodeId, prompt) => {
  if (stopGeneration) return;

  // show "Generating..." state
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
      body: JSON.stringify({ nodeId, description: prompt ,  scenario_id: scenarioId }),
    });
    const data = await res.json();

    if (!res.ok || !data.images?.length)
      throw new Error(data.error || "No images returned");

    // ✅ backend already returns ready-to-use URLs
    const updatedImages = data.images.map((url) =>
      url.startsWith("http")
        ? `${url}?t=${Date.now()}`
        : `http://127.0.0.1:5000${url}?t=${Date.now()}`
    );

    const primary = updatedImages[0];

    // ✅ update node list so ReactFlow + sidebar refresh immediately
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                imageUrl: primary,
                generatedImages: updatedImages,
                loadingImages: false,
              },
            }
          : n
      )
    );

    // ✅ update selectedNode state too so sidebar shows instantly
    setSelectedNode((prev) =>
      prev && prev.id === nodeId
        ? {
            ...prev,
            data: {
              ...prev.data,
              imageUrl: primary,
              generatedImages: updatedImages,
              loadingImages: false,
            },
          }
        : prev
    );

    console.log(`🖼️ Updated node ${nodeId} with ${updatedImages.length} new images`);
  } catch (err) {
    console.error("❌ handleReprompt error:", err);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, loadingImages: false } }
          : n
      )
    );
  }
};

  const selectImageForNode = (nodeId, imgUrl) =>
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, imageUrl: imgUrl } } : n
      )
    );

  // Guarded auto-generation (batched)
  const autoGenerateImagesForAll = async (nodesList) => {
    if (AUTO_GEN_RUNNING) {
      console.warn("⚠️ Skipping duplicate generation: already running.");
      return;
    }
    AUTO_GEN_RUNNING = true;
    setLoadingOverlay(true);
    stopGeneration = false;

    try {
      const BATCH_SIZE = 3;
      for (let i = 0; i < nodesList.length; i += BATCH_SIZE) {
        if (stopGeneration) break;
        const batch = nodesList
          .slice(i, i + BATCH_SIZE)
          .filter((n) => ["scenario", "ending"].includes(n.type));
        await Promise.all(batch.map((n) => handleReprompt(n.id, n.data.data_description)));
      }
    } finally {
      AUTO_GEN_RUNNING = false;
      setLoadingOverlay(false);
      console.log("✅ Auto-generation finished or stopped.");
    }
  };

  // Save & Play (clean payload)
  const handleSaveAndPlay = async () => {
    console.log("🎬 [Save&Play]");

    const updatedEdges = generateEdgesFromNodes(nodes);
    setEdges(updatedEdges);

    // ensure descriptions
    const missing = nodes.filter((n) => !n.data?.data_description?.trim());
    if (missing.length > 0) {
      setNodes((nds) =>
        nds.map((n) =>
          !n.data?.data_description?.trim()
            ? { ...n, data: { ...n.data, data_description: "(Auto-filled placeholder)" } }
            : n
        )
      );
    }

    const cleanNodes = nodes.map((n) => {
      let b64image = "";
      let imageUrl = n.data.imageUrl || "";
      if (imageUrl.startsWith("data:image/")) {
        b64image = imageUrl.split(",")[1];
        imageUrl = ""; // no inline base64 in DB
      } else if (n.data.b64image) {
        b64image = n.data.b64image;
      }
      return {
        ...n,
        data: {
          data_description: n.data.data_description || "Untitled",
          scene: n.data.scene || "",
          options: n.data.options || [],
          next: n.data.next || null,
          title: scenarioTitle,
          imageUrl,
          b64image,
          generatedImages: n.data.generatedImages || [],
        },
      };
    });

    const backendNodes = convertFrontendToBackend(cleanNodes);
    const updatedScenario = {
      id: /^[0-9a-fA-F]{24}$/.test(scenarioId) ? scenarioId : null,
      title: scenarioTitle || "Untitled Scenario",
      description: "",
      nodes: backendNodes,
      edges: updatedEdges,
      lastEdited: new Date().toISOString(),
    };

    try {
      const res = await fetch("http://127.0.0.1:5000/scenarios/saveFlow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedScenario),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed");

      // update scenario id if new
      let finalScenarioId = scenarioId;
      if (data.scenarioId) {
        finalScenarioId = data.scenarioId;
        setScenarioId(finalScenarioId);
        await localforage.setItem("lastScenarioId", finalScenarioId);
      }

      // mark status after save succeeds
      await updateScenarioStatus(finalScenarioId, "images");

      // clear light cache
      await localforage.removeItem(CACHE_KEY);

      // navigate to simulation with clean flow
      navigate("/simulation", {
        state: {
          scenarioId: finalScenarioId,
          flowData: {
              scenarioTitle,
            startNodeId: cleanNodes[0].id,
            nodes: cleanNodes,
            edges: updatedEdges,
          },
        },
      });
    } catch (err) {
      console.error("❌ Save or navigation failed:", err);
      alert("⚠️ Error saving scenario. Check console for details.");
    }
  };

  // unmount cleanup
  useEffect(() => {
    return () => {
      stopGeneration = true;
      AUTO_GEN_RUNNING = false;
      setLoadingOverlay(false);
      console.log("🧹 SceneEditor unmounted — stopped image generation.");
    };
  }, []);

  return (
    <div className="scene-editor-container">
      <NavigationBar />

      <div className="editor-container">
        <div className="floating-toolbar">
          <button onClick={handleSaveAndPlay}>💾 Save & Play</button>
          <button onClick={handleAutoLayout}>🧭 Auto Layout</button>

         <button
  onClick={(e) => {
    const force = e.shiftKey;
    const targets = force
      ? nodes.filter((n) => ["scenario", "ending"].includes(n.type))
      : nodes.filter((n) => ["scenario", "ending"].includes(n.type) && !hasValidImage(n));

    if (targets.length === 0) {
      alert(force ? "No nodes found!" : "✅ All nodes already have valid images!");
      return;
    }

    console.log(`🖼️ ${force ? "Force" : "Missing"} regenerate → ${targets.length} nodes`);
    autoGenerateImagesForAll(targets);
  }}
  disabled={loadingOverlay}
  title="Hold Shift to force regenerate all"
>
  🔁 Regenerate All
</button>

          <button
            onClick={async () => {
              const lightweightFlow = getLightweightFlow(nodes, edges);
              await localforage.setItem("latestFlow", lightweightFlow);
              navigate("/editor", { state: { flowData: lightweightFlow } });
            }}
          >
            🗺️ Back to Flow
          </button>
        </div>

        <div className="scene-editor-content">
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
                      onClick={() => handleReprompt(selectedNode.id, promptText)}
                      disabled={selectedNode.data.loadingImages}
                    >
                      {selectedNode.data.loadingImages
                        ? "⚙️ Generating..."
                        : "✨ Regenerate Images"}
                    </button>
                  </details>

                  <details open className="sidebar-section-variations">
                    <summary>🎨 Generated Variations</summary>
                    {selectedNode.data.generatedImages?.length > 0 ? (
                      <div className="image-carousel">
                        {selectedNode.data.generatedImages.map((imgUrl, i) => {
                          if (!imgUrl) return null;
                          return (
                            <div
                              key={i}
                              className={`image-thumb-wrapper ${
                                imgUrl === selectedNode.data.imageUrl ? "selected" : ""
                              }`}
                              onClick={() => selectImageForNode(selectedNode.id, imgUrl)}
                            >
                              <img
  key={imgUrl}
  src={
    imgUrl.startsWith("http")
      ? `${imgUrl}`
      : `http://127.0.0.1:5000${imgUrl}`
  }
  alt={`Option ${i}`}
  className="image-thumb"
  onError={(e) => {
    console.warn("⚠️ Image failed to load:", imgUrl);
    e.target.src =
      "https://dummyimage.com/200x120/cccccc/000000&text=Preview+Unavailable";
  }}
/>

                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="sidebar-empty-text">
                        No images generated yet. Click ✨ to generate.
                      </p>
                    )}
                  </details>

                  {selectedNode.data.imageUrl && (
                    <details open className="sidebar-section">
                      <summary>🖼️ Selected Image</summary>
                      <img
  key={selectedNode.data.imageUrl}
  src={selectedNode.data.imageUrl}
  alt="Selected"
  className="selected-image-preview"
/>

                    </details>
                  )}
                </div>

                <div className="sidebar-footer">
                  {selectedNode.data.loadingImages ? <span>⚙️ Generating...</span> : <span>💾 Auto-saved</span>}
                </div>
              </>
            ) : (
              <div className="sidebar-empty">
                <p>Click a node to edit prompt and images</p>
              </div>
            )}
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
        <div
          className="floating-status-box"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#1e1e2f",
            color: "white",
            padding: "10px 14px",
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "14px",
              height: "14px",
              border: "2px solid white",
              borderTop: "2px solid #4CAF50",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <span>Generating images...</span>
          <button
            onClick={() => {
              stopGeneration = true;
              setLoadingOverlay(false);
              console.warn("🛑 Generation manually stopped by user.");
              fetch("http://127.0.0.1:5000/stop_generation", { method: "POST" }).catch(() => {});
            }}
            style={{
              background: "#c62828",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
};

export default SceneEditor;
