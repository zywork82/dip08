// src/pages/SimulationInterface.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import NavigationBar from "../components/SlimNavBar";
import SharedHeader from "../components/SharedHeader";
import "../styles/Global.css";
import "../styles/SimulationInterface.css";

// ========= Helpers =========
const byId = (arr = []) => Object.fromEntries((arr || []).map((n) => [String(n.id), n]));

// Prefer data.imageUrl (http or dataURL) else fallback to b64image
const getImageSrc = (node) => {
  const url = node?.data?.imageUrl || "";
  const b64 = node?.data?.b64image || "";
  if (url && (url.startsWith("http") || url.startsWith("data:image"))) return url;
  if (b64 && b64.length > 100) return `data:image/png;base64,${b64}`;
  return ""; // will render a placeholder
};

// Build edges if missing, based on your schema:
//  - scenario node: data.options[] -> edge to each option node
//  - option node: data.next -> edge to next scene
const generateEdgesFromNodes = (nodes = []) => {
  const edges = [];
  nodes.forEach((n) => {
    const d = n.data || {};
    if (n.type === "scenario" && Array.isArray(d.options)) {
      d.options.forEach((optId) => {
        if (nodes.find((x) => String(x.id) === String(optId))) {
          edges.push({
            id: `e-${n.id}-${optId}`,
            source: String(n.id),
            target: String(optId),
          });
        }
      });
    }
    if (n.type === "option" && d.next) {
      if (nodes.find((x) => String(x.id) === String(d.next))) {
        edges.push({
          id: `e-${n.id}-${d.next}`,
          source: String(n.id),
          target: String(d.next),
        });
      }
    }
  });
  // de-dup
  const map = new Map(edges.map((e) => [e.id, e]));
  return Array.from(map.values());
};

// Find a sensible starting node
const resolveStartNodeId = (flow) => {
  if (!flow) return null;
  const nodes = flow.nodes || [];
  if (flow.startNodeId && nodes.find((n) => String(n.id) === String(flow.startNodeId)))
    return String(flow.startNodeId);
  if (nodes.find((n) => String(n.id) === "101")) return "101";
  const firstScenario = nodes.find((n) => n.type === "scenario");
  if (firstScenario) return String(firstScenario.id);
  return nodes[0] ? String(nodes[0].id) : null;
};

// ========= Component =========
const SimulationInterface = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Load flowData from navigation or localStorage
  const passedFlow = location.state?.flowData;
  const passedScenarioId = location.state?.scenarioId;
  const [flowData, setFlowData] = useState(null);
  const [scenarioId, setScenarioId] = useState(passedScenarioId || localStorage.getItem("lastScenarioId") || null);

  // Play state
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [historyStack, setHistoryStack] = useState([]); // stack of previous scene nodeIds
  const [choicesLog, setChoicesLog] = useState([]); // {at, from, optionId, to}
  const [sceneStartTime, setSceneStartTime] = useState(null);
  const [isAdmin] = useState(true); // ← replace with real auth check later
const [panelMinimized, setPanelMinimized] = useState(false);

  const profileImage = "https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A";

  // Initial flow boot
  useEffect(() => {
    // Order of truth:
    // 1) state.flowData
    // 2) localStorage latestFlow (what SceneEditor writes)
    let loaded =
      passedFlow ||
      JSON.parse(localStorage.getItem("latestFlow") || "null") ||
      null;

    if (!loaded) {
      console.warn("⚠️ No flowData found. Did you navigate here from SceneEditor?");
      setFlowData(null);
      return;
    }

    // Ensure nodes/edges exist
    const nodes = loaded.nodes || [];
    const edges = loaded.edges && loaded.edges.length > 0 ? loaded.edges : generateEdgesFromNodes(nodes);

    const normalized = { ...loaded, nodes, edges };
    setFlowData(normalized);
    setCurrentNodeId(resolveStartNodeId(normalized));
    

    // Persist a minimal play session marker (useful for recovery)
    try {
      if (scenarioId) localStorage.setItem("lastScenarioId", scenarioId);
      localStorage.setItem("lastPlaythrough", JSON.stringify({ scenarioId: scenarioId || "temp", ts: Date.now() }));
    } catch (e) {
      // ignore quota issues
    }
  }, [passedFlow, scenarioId]);

  // Derived maps
  const nodeMap = useMemo(() => byId(flowData?.nodes || []), [flowData]);
  const edges = useMemo(
    () =>
      (flowData?.edges && flowData.edges.length > 0
        ? flowData.edges
        : generateEdgesFromNodes(flowData?.nodes || [])) || [],
    [flowData]
  );

  // Build adjacency
  const outgoingBySource = useMemo(() => {
    const map = {};
    edges.forEach((e) => {
      const src = String(e.source);
      if (!map[src]) map[src] = [];
      map[src].push(e);
    });
    return map;
  }, [edges]);

  const currentNode = currentNodeId ? nodeMap[currentNodeId] : null;
  useEffect(() => {
    if (currentNodeId) {
      setSceneStartTime(Date.now());
    }
  }, [currentNodeId]);

  // When user picks one of the option nodes from a scenario, auto-advance to that option's "next" scene.
 const goViaOption = (scenarioNodeId, optionNodeId) => {
  const optionNode = nodeMap[String(optionNodeId)];
  const now = Date.now();
  const timeTaken = sceneStartTime ? (now - sceneStartTime) / 1000 : 0; // seconds

  // ✅ Find the next scene by checking edges from this option node
  const toEdges = outgoingBySource[String(optionNodeId)] || [];
  let nextSceneId = null;

  if (toEdges.length > 0) {
    nextSceneId = String(toEdges[0].target); // usually one
  } else if (optionNode?.data?.next) {
    nextSceneId = String(optionNode.data.next);
  } else {
    const candidate = Object.values(nodeMap).find(
      (n) =>
        n.type === "scenario" &&
        Array.isArray(n.data?.options) &&
        n.data.options.includes(optionNodeId)
    );
    if (candidate) nextSceneId = String(candidate.id);
  }

  // 🧾 Log the choice, including timeTaken
  setChoicesLog((log) => [
    ...log,
    {
      at: now,
      from: String(scenarioNodeId),
      optionId: String(optionNodeId),
      to: nextSceneId || "(none)",
      timeTaken,
    },
  ]);

  // Push to history and move forward
  setHistoryStack((h) => [...h, String(scenarioNodeId)]);

  if (nextSceneId) {
    console.log(`➡️ Moving to next scene: ${nextSceneId} (⏱️ ${timeTaken.toFixed(2)}s)`);
    setCurrentNodeId(nextSceneId);
  } else {
    console.warn(`⚠️ Option ${optionNodeId} has no linked next scene.`);
    setCurrentNodeId(String(optionNodeId)); // stay on option node
  }
};


  const goBack = () => {
    setHistoryStack((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setCurrentNodeId(prev);
      return h.slice(0, -1);
    });
  };

  const restart = () => {
    setHistoryStack([]);
    setChoicesLog([]);
    setCurrentNodeId(resolveStartNodeId(flowData));
  };

  const isEnd =
    currentNode &&
    (!outgoingBySource[String(currentNode.id)] ||
      outgoingBySource[String(currentNode.id)].length === 0) &&
    // if it's a scenario but options exist in data, it's not end
    !(
      currentNode.type === "scenario" &&
      Array.isArray(currentNode.data?.options) &&
      currentNode.data.options.length > 0
    );

  // What to render for actions
  // If current node is a scenario, present option buttons based on its outgoing to option nodes.
  const optionButtons = useMemo(() => {
    if (!currentNode || currentNode.type !== "scenario") return [];
    // For robustness, take *either* data.options[] or edges from adjacency
    const candidateOptionIds =
      (Array.isArray(currentNode.data?.options) && currentNode.data.options.length > 0
        ? currentNode.data.options.map(String)
        : (outgoingBySource[String(currentNode.id)] || []).map((e) => String(e.target))) || [];

    // Only keep those that are option nodes
    const filtered = candidateOptionIds
      .map((id) => nodeMap[id])
      .filter((n) => n && n.type === "option");

    // Button label = option node's data_description (fallback to id)
    return filtered.map((opt) => ({
      id: String(opt.id),
      label: opt.data?.data_description?.trim() || `Option ${opt.id}`,
    }));
  }, [currentNode, nodeMap, outgoingBySource]);

  // UI
  if (!flowData || !currentNode) {
    return (
      <div className="scene-editor-container">
        <NavigationBar />
        <div className="editor-container">
          <SharedHeader profileImage={profileImage} userName="Prof Andy" userRole="Administrator" />
          <h2>No scenario loaded</h2>
          <p>Try saving &amp; launching from the Scene Editor again.</p>
          <button
            className="action-buttons"
            onClick={() => navigate("/scene-editor", { state: { scenarioId } })}
          >
            ← Back to Image Editor
          </button>
        </div>
      </div>
    );
  }

  const imageSrc = getImageSrc(currentNode);
  const text = currentNode.data?.data_description || "(no description)";
  const atStart = historyStack.length === 0;

  return (
    <div className="scene-editor-container">
      <NavigationBar />
      <div className="editor-container">
        <div className="header">
          <SharedHeader profileImage={profileImage} userName="Prof Andy" userRole="Administrator" />
        </div>

        <div className="scenario-interface-layout" >
          {/* Main stage */}
          <div className="stage">
            {/* Scene image */}
            <div
              className="scene-image-wrapper"
              
            >
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={`Scene ${currentNode.id}`}
                  
                />
              ) : (
                <div >(No image selected for this scene)</div>
              )}
           <div className="infobox">
              {/* Options or End */}
              <div className="optionsWrapper">
                {/* Scene text */}
              <div
                className="scene-text"
              >
                {/* <h3>Scene {String(currentNode.id)}</h3> */}
                <p s>{text}</p>
              </div> 
                {currentNode.type === "scenario" && optionButtons.length > 0 ? (
                  <div className="options-grid" >
                    {optionButtons.map((opt) => (
                      <button
                        key={opt.id}
                        className="action-buttons"
                        onClick={() => goViaOption(currentNode.id, opt.id)}
                    
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : isEnd ? (
                  <div>
                    <strong>Scenario complete.</strong>
                    <div >
                      <button className="action-buttons" onClick={restart}>🔁 Restart</button>
                      <button
                        className="action-buttons"
                        onClick={() =>
                          navigate("/report", {
                            state: { scenarioId, choicesLog, flowData },
                          })
                        }
                      >
                        📊 View Report
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              
              
              </div></div>
          

          {/* 🧭 Floating Admin Panel */}
  {/* const isAdmin = localStorage.getItem("userRole") === "Administrator"; */}

{isAdmin && (
  <div
    className={`admin-panel ${panelMinimized ? "minimized" : ""}`}
    style={{
      position: "fixed",
      top: "1rem",
      right: "1rem",
      background: "rgba(255,255,255,0.95)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      borderRadius: "12px",
      padding: "1rem",
      width: panelMinimized ? "200px" : "340px",
      maxHeight: panelMinimized ? "60px" : "80vh",
      overflowY: "auto",
      transition: "all 0.3s ease",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.5rem",
      }}
    >
      <h4 style={{ margin: 0 }}>🧭 Admin Panel</h4>
      <button
        onClick={() => setPanelMinimized(!panelMinimized)}
        style={{
          border: "none",
          background: "transparent",
          fontSize: "1.2rem",
          cursor: "pointer",
        }}
        title={panelMinimized ? "Expand" : "Minimize"}
      >
        {panelMinimized ? "🔽" : "🔼"}
      </button>
    </div>

    {!panelMinimized && (
      <>
        {/* Navigation Buttons */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <button className="action-buttons" onClick={() => navigate("/scene-editor", { state: { scenarioId, flowData } })}>
            ✏️ Edit Images
          </button>
          <button className="action-buttons" onClick={() => navigate("/editor", { state: { scenarioId, flowData } })}>
            🧭 Edit Flow
          </button>
          <button className="action-buttons" disabled={atStart} onClick={goBack}>
            ⬅️ Back
          </button>
          <button className="action-buttons" onClick={restart}>
            🔄 Restart
          </button>
        </div>

        {/* Run Log */}
        <div>
          <h5 style={{ marginTop: "0.5rem" }}>Run Log</h5>
          {choicesLog.length === 0 ? (
            <div>No choices yet.</div>
          ) : (
            <ol style={{ paddingLeft: "1.2rem", fontSize: "0.9rem" }}>
              {choicesLog.map((c, i) => (
                <li key={i}>
                  <code>{new Date(c.at).toLocaleTimeString()}</code> — Scene{" "}
                  <strong>{c.from}</strong> → Option <strong>{c.optionId}</strong>
                  {c.to ? (
                    <>
                      {" "}→ Scene <strong>{c.to}</strong> ({c.timeTaken?.toFixed(1)}s)
                    </>
                  ) : (
                    " (no next)"
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </>
    )}
  </div>
)}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationInterface;
