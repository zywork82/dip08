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
import { saveActiveFlow } from "../utils/sharedCache";

import localforage from "localforage";
import { getLayoutedNodes, centerSiblings } from "../utils/autoLayout";


import "reactflow/dist/style.css";
import "../styles/SceneEditor.css";
import { sanitizeFlowForNavigation } from "../utils/flowSanitiser";
// 🚫 Gemini quota exhaustion guard
let GEMINI_QUOTA_EXCEEDED = false;
// 🚨 Global stop flag
let stopGeneration = false;
let AUTO_GEN_RUNNING = false;

// ===============================
// 🧠 SceneEditor Cache Helpers (safe + lightweight)
// ===============================
const CACHE_KEY = "sceneEditorCache_v1";

// ✅ Save lightweight node info (no base64)
const saveNodesToCache = async (nodes) => {
  try {
    const simplified = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: {
        data_description: n.data?.data_description || "",
        imageUrl: n.data?.imageUrl || "",
        generatedImages: n.data?.generatedImages?.slice(0, 3) || [],
      },
      position: n.position,
    }));

    const existing = (await localforage.getItem(CACHE_KEY)) || [];
    const merged = mergeCachedNodes(existing, simplified);

    await localforage.setItem(CACHE_KEY, merged);
    console.log(`💾 Cached ${simplified.length} node(s) with images`);
  } catch (err) {
    console.warn("⚠️ Failed to cache nodes:", err);
  }
};

// ✅ Load cached nodes
const loadNodesFromCache = async () => {
  try {
    const cached = await localforage.getItem(CACHE_KEY);
    if (!cached) return [];
    console.log(`🔄 Restored ${cached.length} node(s) from cache`);
    return cached;
  } catch (err) {
    console.warn("⚠️ Failed to load cache:", err);
    return [];
  }
};

// ✅ Merge cached and new node data (keep existing images)
const mergeCachedNodes = (oldNodes, newNodes) => {
  const map = new Map(oldNodes.map((n) => [n.id, n]));
  newNodes.forEach((n) => {
    const existing = map.get(n.id);
    if (existing) {
      map.set(n.id, {
        ...existing,
        ...n,
        data: {
          ...existing.data,
          ...n.data,
          generatedImages: Array.from(
            new Set([
              ...(existing.data.generatedImages || []),
              ...(n.data.generatedImages || []),
            ])
          ).slice(0, 5),
        },
      });
    } else {
      map.set(n.id, n);
    }
  });
  return Array.from(map.values());
};

// ✅ Helper to update scenario status in backend
async function updateScenarioStatus(scenarioId, newStatus) {
  try {
    const res = await fetch(`http://127.0.0.1:5000/scenarios/updateStatus/${scenarioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update status");
    console.log(`🟢 Scenario ${scenarioId} status updated → ${newStatus}`);
    return true;
  } catch (err) {
    console.error("❌ Failed to update scenario status:", err);
    return false;
  }
}

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

    // // ✅ Add retry callback (connected to SceneEditor’s function)
    // onRetry: (nodeId) => handleReprompt(nodeId, node.data?.data_description || ""),
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
// 💾 Persist and auto-recover scenarioId
useEffect(() => {
  if (scenarioId) {
    localStorage.setItem("lastScenarioId", scenarioId);
    console.log("💾 SceneEditor cached scenarioId:", scenarioId);
  } else {
    const fallbackId = localStorage.getItem("lastScenarioId");
    if (fallbackId) {
      setScenarioId(fallbackId);
      console.log("♻️ SceneEditor restored scenarioId from localStorage:", fallbackId);
    }
  }
}, [scenarioId]);

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
      // 🧩 Prioritize navigation → state → storage
      let idToLoad =
        location.state?.scenarioId ||
        scenarioId ||
        localStorage.getItem("lastScenarioId");

      // 🚫 Skip if missing or not a valid MongoDB ObjectId
      if (!idToLoad || !/^[0-9a-fA-F]{24}$/.test(idToLoad)) {
        console.warn("⚠️ Invalid or missing scenarioId — skipping fetch");
        return;
      }

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

      let layoutedNodes = getLayoutedNodes(standardizedNodes, data.edges || []);
layoutedNodes = centerSiblings(layoutedNodes, data.edges || []);

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
  console.log("🧭 Auto Layout: Dagre + Centering");
  let layouted = getLayoutedNodes(nodes, edges);
  layouted = centerSiblings(layouted, edges);
  setNodes(layouted);
};
const handleReprompt = async (nodeId, prompt) => {
  if (stopGeneration) return;
  setNodes(nds =>
    nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, loadingImages: true } } : n)
  );

  try {
    const res = await fetch("http://127.0.0.1:5000/scenarios/updateImage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, description: `Training Scenario Visualization:
  "${prompt}"
  Create a realistic, cinematic-style image fitting a professional decision-making context. 
  Show human emotion subtly. Avoid text or labels.`,
}),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate");

    // upload first image only
    let imageUrl = "";
    const img = data.images?.[0];
    if (img?.startsWith("data:image")) {
      const upload = await fetch("http://127.0.0.1:5000/scenarios/uploadTempImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, b64image: img }),
      });
      const upData = await upload.json();
      imageUrl = upData.url?.startsWith("http")
        ? upData.url
        : `http://127.0.0.1:5000${upData.url}`;
    }

    setNodes(nds =>
      nds.map(n =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                imageUrl,
                generatedImages: [imageUrl, ...(n.data.generatedImages || [])].slice(0, 5),
                loadingImages: false,
              },
            }
          : n
      )
    );
  } catch (err) {
    console.error("Reprompt error:", err);
    setNodes(nds =>
      nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, loadingImages: false, failedImage: true } } : n)
    );
  }
};

//  const handleReprompt = async (nodeId, prompt) => {
//   // 🛑 Abort early if user has pressed Stop
//   stopGeneration = false; // ✅ reset before starting
//   if (stopGeneration) {
//     console.warn(`🛑 handleReprompt() aborted before start for node ${nodeId}`);
//     return;
//   }

//   const node = nodes.find((n) => n.id === nodeId);
//   if (!node) {
//     console.warn(`⚠️ Node ${nodeId} not found in state.`);
//     return;
//   }

//   if (node.data.loadingImages) {
//     console.log(`⚠️ Skipping duplicate generation for node ${nodeId}`);
//     return;
//   }

//   // Mark as loading
//   setNodes((nds) =>
//     nds.map((n) =>
//       n.id === nodeId
//         ? { ...n, data: { ...n.data, loadingImages: true, failedImage: false } }
//         : n
//     )
//   );

//   try {
//     // 🧩 Fetch request to backend
//     const res = await fetch("http://127.0.0.1:5000/scenarios/updateImage", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         nodeId,
//         description: `Training Scenario Visualization:
// "${prompt}"
// Create a realistic, cinematic-style image fitting a professional decision-making context. 
// Show human emotion subtly. Avoid text or labels.`,
  //       }),
  //     });

//     // 🛑 If user pressed stop while waiting for backend
//     if (stopGeneration) {
//       console.warn(`🛑 Generation interrupted mid-request for node ${nodeId}`);
//       setNodes((nds) =>
//         nds.map((n) =>
//           n.id === nodeId
//             ? { ...n, data: { ...n.data, loadingImages: false } }
//             : n
//         )
//       );
//       return;
//     }

//     const data = await res.json();
//     if (!res.ok || !data.success) {
//       throw new Error(data.error || "Backend error during image regeneration");
//     }

//     // 🧩 Normalize images (string or object)
//     const images = (data.images || [])
//       .map((img) =>
//         typeof img === "string"
//           ? `data:image/png;base64,${img}`
//           : img?.image_b64
//           ? `data:image/png;base64,${img.image_b64}`
//           : null
//       )
//       .filter(Boolean);
// // =====================================================
// // ✅ Step: Upload the first image to backend temp storage
// // =====================================================
// let imageUrl = images[0] || "";
// try {
//   if (imageUrl && imageUrl.startsWith("data:image/")) {
//     const uploadResp = await fetch("http://127.0.0.1:5000/scenarios/uploadTempImage", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         node_id: nodeId,
//         b64image: imageUrl,
//       }),
//     });
//     const uploadData = await uploadResp.json();
//     if (uploadData.success && uploadData.url) {
//     imageUrl = uploadData.url.startsWith("http")
//   ? uploadData.url
//   : `http://127.0.0.1:5000${uploadData.url}`;
// // 🖼 use the lightweight URL instead of b64
//       console.log(`🖼 Temp image uploaded: ${uploadData.url}`);
//     } else {
//       console.warn("⚠️ Temp upload failed, keeping base64 inline:", uploadData);
//     }
//   }
// } catch (uploadErr) {
//   console.warn("⚠️ Temp upload request failed:", uploadErr);
// }

//     if (stopGeneration) {
//       console.warn(`🛑 Generation canceled after response for node ${nodeId}`);
//       setNodes((nds) =>
//         nds.map((n) =>
//           n.id === nodeId
//             ? { ...n, data: { ...n.data, loadingImages: false } }
//             : n
//         )
//       );
//       return;
//     }

//     if (images.length === 0) {
//       console.warn(`⚠️ No images returned for node ${nodeId}`);
//       throw new Error("No images returned from backend");
//     }

//     // ✅ Update node with all new images
//     setNodes((nds) =>
//       nds.map((n) =>
//         n.id === nodeId
//           ? {
//               ...n,
//               data: {
//                 ...n.data,
//                 imageUrl: imageUrl,
//                 generatedImages: [
//                   ...images,
//                   ...(n.data.generatedImages || []),
//                 ].slice(0, 5),
//                 loadingImages: false,
//                 failedImage: false,
//               },
//             }
//           : n
//       )
//     );

//     console.log(`✅ Added ${images.length} new images for node ${nodeId}`);

//     // 💾 Cache updated node (skip if stop was pressed)
//     if (!stopGeneration) {
//       await saveNodesToCache([
//         {
//           ...node,
//           data: {
//             ...node.data,
//             imageUrl: imageUrl,
//             generatedImages: images,
//           },
//         },
//       ]);
//     }
//   } catch (err) {
//     if (stopGeneration) {
//       console.warn(`🛑 handleReprompt() caught stop signal for node ${nodeId}`);
//     } else {
//       console.error("❌ handleReprompt error:", err);
//     }

//     // Ensure node isn't stuck in loading state
//     setNodes((nds) =>
//       nds.map((n) =>
//         n.id === nodeId
//           ? {
//               ...n,
//               data: {
//                 ...n.data,
//                 loadingImages: false,
//                 failedImage: !stopGeneration, // mark failed only if real error
//               },
//             }
//           : n
//       )
//     );
//   }
// };


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
  setLoadingOverlay(false);
  stopGeneration = false;

  // for (const node of nodesList) {
  //   if (stopGeneration) break;
  //   const hasImages = node.data.generatedImages?.length > 0;
  //   const failed = node.data.failedImage;
  //   if (!hasImages && !failed) {
  //     await handleReprompt(node.id, node.data.data_description);
  //   }
  // }
//   const BATCH_SIZE = 3;
// for (let i = 0; i < nodesList.length; i += BATCH_SIZE) {
//   const batch = nodesList.slice(i, i + BATCH_SIZE);
//   await Promise.all(
//     batch.map((n) => handleReprompt(n.id, n.data.data_description))
//   );
// }
const BATCH_SIZE = 3;
for (let i = 0; i < nodesList.length; i += BATCH_SIZE) {
  const batch = nodesList
    .slice(i, i + BATCH_SIZE)
    .filter((n) => ["scenario", "ending"].includes(n.type)); // ✅ only these
  await Promise.all(
    batch.map((n) => handleReprompt(n.id, n.data.data_description))
  );
}


  AUTO_GEN_RUNNING = false;
  setLoadingOverlay(false);
};


// Initial load
// Initial load
useEffect(() => {
  (async () => {
    let flowData = passedFlow || (await localforage.getItem("latestFlow"));

    // 🧠 Try restoring cached images
    const cachedNodes = await loadNodesFromCache();
    if (cachedNodes.length > 0 && flowData?.nodes?.length) {
      console.log("🔄 Merging cached images into loaded nodes...");
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

    // 🧩 NEW STEP: Upload any leftover base64 images to temp folder (with progress)
    const uploadBase64Images = async (nodes) => {
      const updatedNodes = [];
      const base64Nodes = nodes.filter(
        (n) => n.data?.imageUrl?.startsWith("data:image/")
      );
      const total = base64Nodes.length;

      if (total > 0)
        console.log(`🧠 Found ${total} cached base64 images → uploading...`);

      let uploaded = 0;
      for (const node of nodes) {
        const imgUrl = node.data?.imageUrl || "";
        if (imgUrl.startsWith("data:image/")) {
          try {
            const res = await fetch(
              "http://127.0.0.1:5000/scenarios/uploadTempImage",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ node_id: node.id, b64image: imgUrl }),
              }
            );
            const data = await res.json();
            if (data.success && data.url) {
              node.data.imageUrl = data.url;
              uploaded++;

              // Throttled progress display every 3 uploads
              if (uploaded % 3 === 0 || uploaded === total) {
                console.log(
                  `📤 [Upload Progress] ${uploaded}/${total} converted → latest: ${data.url}`
                );
              }
            }
          } catch (err) {
            console.warn(`⚠️ Upload failed for node ${node.id}:`, err);
          }
        }
        updatedNodes.push(node);
      }

      if (total > 0)
        console.log(`✅ Completed ${uploaded}/${total} base64 → temp image conversions`);
      return updatedNodes;
    };

    if (flowData?.nodes?.length > 0) {
      flowData.nodes = await uploadBase64Images(flowData.nodes);
    }

    // 🧩 continue with your existing logic
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
    const missingImages = layoutedNodes.filter(
  (n) =>
    ["scenario", "ending"].includes(n.type) && !hasValidImage(n)
);


    console.log(
      `🧩 Image status check → ${nodesWithImages}/${totalNodes} nodes have valid images.`
    );

    if (missingImages.length > 0) {
      const trulyMissing = missingImages.filter(
        (n) => !n.data?.b64image || n.data.b64image.length < 100
      );

      if (trulyMissing.length > 0) {
        console.warn(
          `🖼️ Auto-generating ${trulyMissing.length} *new* missing images...`
        );
        setLoadingOverlay(false);
        autoGenerateImagesForAll(trulyMissing).finally(() =>
          setLoadingOverlay(false)
        );
      } else {
        console.log(
          "✅ All nodes have stored base64 images. Skipping regeneration."
        );
      }
    } else {
      console.log(
        "✅ All nodes already have valid images. Skipping generation."
      );
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
    ["scenario", "ending"].includes(n.type) &&
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
  console.log("🎬 [Save&Play] Triggered!");

  let finalScenarioId = scenarioId;
  const updatedEdges = generateEdgesFromNodes(nodes);
  setEdges(updatedEdges);

  console.log("🧱 Step 1: Edges regenerated:", updatedEdges.length);

  // Step 2 — Validate nodes
  const missing = nodes.filter((n) => !n.data?.data_description?.trim());
  if (missing.length > 0) {
    console.warn("⚠️ Nodes missing descriptions:", missing.map((n) => n.id));
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
  } else {
    console.log("✅ All nodes have descriptions.");
  }

  // Step 3 — Clean node data
  const cleanNodes = nodes.map((n) => {
    // let imageUrl = n.data.imageUrl || "";
    // let b64image = "";

    // if (imageUrl.startsWith("data:image/")) {
    //   b64image = imageUrl.split(",")[1];
    // } else {
    //   b64image = n.data.b64image || "";
    // }

let b64image = "";
let imageUrl = n.data.imageUrl || "";

if (imageUrl.startsWith("data:image/")) {
  // convert base64 inline → to b64image for save
  b64image = imageUrl.split(",")[1];
  imageUrl = ""; // remove inline b64 to save space
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
        imageUrl,
        b64image,
        generatedImages: n.data.generatedImages || [],
      },
    };
  });



  console.log(`🧹 Step 3: Cleaned ${cleanNodes.length} nodes.`);

  // Step 4 — Prepare backend format
  // const flowToSaveBackend = {
  //   nodes: convertFrontendToBackend(
  //     Object.fromEntries(cleanNodes.map((n) => [n.id, n]))
  //   ),
  //   edges: updatedEdges,
  // };

  // const updatedScenario = {
  //   id: /^[0-9a-fA-F]{24}$/.test(scenarioId) ? scenarioId : null,
  //   title: scenarioTitle || "Untitled Scenario",
  //   description: "",
  //   nodes: Object.values(flowToSaveBackend.nodes),
  //   edges: flowToSaveBackend.edges || [],
  //   lastEdited: new Date().toISOString(),
  // };
// ✅ convertFrontendToBackend already returns an array
const backendNodes = convertFrontendToBackend(cleanNodes);

const updatedScenario = {
  id: /^[0-9a-fA-F]{24}$/.test(scenarioId) ? scenarioId : null,
  title: scenarioTitle || "Untitled Scenario",
  description: "",
  nodes: backendNodes, // <-- use directly
  edges: updatedEdges,
  lastEdited: new Date().toISOString(),
};

  console.log("📤 Step 4: Prepared updatedScenario →", updatedScenario);

  // 🧩 Step 4.5 — Skip backend save if no changes
  const lastSaved = await localforage.getItem("lastSavedScenario");
  if (lastSaved && JSON.stringify(lastSaved) === JSON.stringify(updatedScenario)) {
    console.log("🟢 No changes detected — skipping backend save.");
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
    return;
  }
  console.table(
  cleanNodes.map((n) => ({
    id: n.id,
    hasB64: !!n.data.b64image,
    hasUrl: !!n.data.imageUrl,
    urlSnippet: n.data.imageUrl?.slice(0, 40) || "none",
     b64: n.data?.b64image ? "✅ yes" : "❌ no",
  }))
);


  // Step 5 — Send to backend
  try {
    const res = await fetch("http://127.0.0.1:5000/scenarios/saveFlow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedScenario),
      
    });
    await updateScenarioStatus(scenarioId, "images");

    alert("✅ Images saved and scenario marked as 'images' stage!");
    const data = await res.json();
    console.log("📩 Step 5: Backend response →", data);

    if (!data.success) throw new Error(data.error || "Save failed");

    // Step 6 — Update scenario ID if new
    if (data.scenarioId) {
      finalScenarioId = data.scenarioId;
      setScenarioId(finalScenarioId);
      await localforage.setItem("lastScenarioId", finalScenarioId);
      console.log("🆔 Step 6: Scenario ID updated:", finalScenarioId);
    }

    // 🧠 Remember last-saved scenario snapshot
    await localforage.setItem("lastSavedScenario", updatedScenario);
    console.log("💾 Stored snapshot for future diff-checking.");

    // Step 7 — Clear cache to prevent buildup
    await localforage.removeItem(CACHE_KEY);
    console.log("🧹 Cleared cached images after save.");

    console.log("🚀 Step 7: Navigating to /simulation...");
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
    console.error("❌ Step X: Save or navigation failed:", err);
    alert("⚠️ Error saving scenario. Check console for details.");
  }
};


useEffect(() => {
  return () => {
    stopGeneration = true;
    AUTO_GEN_RUNNING = false;
    console.log("🧹 SceneEditor unmounted — stopped all ongoing image generation.");
  };
}, []);

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
     const missing = nodes.filter(
  (n) =>
    ["scenario", "ending"].includes(n.type) && !hasValidImage(n)
);

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
  onClick={async () => {
    const lightweightFlow = getLightweightFlow(nodes, edges);
    await saveActiveFlow({
      scenarioId,
      flowData: lightweightFlow,
      lastEdited: Date.now(),
    });
    navigate("/editor");
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
              {selectedNode.data.generatedImages.map((imgUrl, i) => {
  if (!imgUrl) return null; // ✅ skip empty strings
  return (
    <div
      key={i}
      className={`image-thumb-wrapper ${
        imgUrl === selectedNode.data.imageUrl ? "selected" : ""
      }`}
      onClick={() => selectImageForNode(selectedNode.id, imgUrl)}
    >
      <img
        src={imgUrl || undefined}
        alt={`Option ${i}`}
        className="image-thumb"
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

      {/* 🧭 Compact Floating Status Panel */}
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
        fetch("http://127.0.0.1:5000/stop_generation", { method: "POST" })
          .then(() => console.log("🧠 Stop signal sent to backend"))
          .catch((err) => console.warn("⚠️ Backend stop request failed:", err));
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
