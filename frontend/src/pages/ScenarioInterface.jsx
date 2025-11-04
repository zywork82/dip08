// src/pages/ScenarioInterface.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Global.css";
import "../styles/ScenarioInterface.css";
import OptionNode from "../components/OptionNode.jsx";
import { motion, AnimatePresence } from "framer-motion";

const ScenarioInterface = ({ onOptionSelect, onGoToReport }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // === Helpers ===
  const normalizeId = (id) => String(id ?? "").trim();

  // === Extract local or passed data ===
  const flowDataFromState = location.state?.flowData || null;
  const flowDataFromStorage = JSON.parse(localStorage.getItem("latestFlow") || "null");
  const scenarioId = location.state?.scenarioId || localStorage.getItem("lastScenarioId");

  console.log("🎯 ScenarioInterface using scenarioId:", scenarioId);

  // === States ===
  const [flowData, setFlowData] = useState(flowDataFromState || flowDataFromStorage);
  const [currentNodeId, setCurrentNodeId] = useState(flowData?.startNodeId || null);
  const [edges, setEdges] = useState([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [choiceHistory, setChoiceHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // ======================================================
  // 🌐 AUTO-FETCH FLOW FROM BACKEND (Always refresh)
  // ======================================================
  useEffect(() => {
    const fetchFlowFromBackend = async () => {
      if (!scenarioId || !/^[0-9a-fA-F]{24}$/.test(scenarioId)) {
        console.warn("⚠️ Invalid or missing scenarioId, skipping backend fetch.");
        return;
      }

      try {
        setLoading(true);
        console.log("🌐 Fetching flow from backend:", scenarioId);

        const res = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${scenarioId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load scenario flow");

        // ✅ Normalize all IDs
        data.nodes = (data.nodes || []).map((n) => ({
          ...n,
          id: normalizeId(n.id),
          data: {
            ...n.data,
            options: (n.data?.options || []).map(normalizeId),
            next: n.data?.next ? normalizeId(n.data.next) : null,
          },
        }));

        data.edges = (data.edges || []).map((e) => ({
          ...e,
          source: normalizeId(e.source),
          target: normalizeId(e.target),
        }));

        // ✅ Set data + start node
        setFlowData(data);
       const startCandidate =
  data.startNodeId && data.nodes.some((n) => n.id === normalizeId(data.startNodeId))
    ? normalizeId(data.startNodeId)
    : data.nodes.find((n) => n.id === "101")?.id ||
      data.nodes[0]?.id ||
      null;

setCurrentNodeId(startCandidate);
console.log("🎬 Corrected start node:", startCandidate);

        // Cache
        localStorage.setItem("latestFlow", JSON.stringify(data));
      } catch (err) {
        console.error("❌ Error fetching scenario from backend:", err);
      } finally {
        setLoading(false);
      }
    };

    if (scenarioId) fetchFlowFromBackend();
  }, [scenarioId]);

  // ======================================================
  // 🧹 CLEAN FLOW (remove invalid node links)
  // ======================================================
  const cleanedFlowData = useMemo(() => {
    if (!flowData?.nodes) return null;

    const validIds = new Set(flowData.nodes.map((n) => normalizeId(n.id)));

    const cleanedNodes = flowData.nodes.map((n) => ({
      ...n,
      id: normalizeId(n.id),
      data: {
        ...n.data,
        options: (n.data?.options || []).filter((o) => validIds.has(normalizeId(o))),
        next: validIds.has(normalizeId(n.data?.next)) ? normalizeId(n.data.next) : null,
      },
    }));

    const cleanedEdges = (flowData.edges || []).filter(
      (e) => validIds.has(normalizeId(e.source)) && validIds.has(normalizeId(e.target))
    );

    return { ...flowData, nodes: cleanedNodes, edges: cleanedEdges };
  }, [flowData]);

  // ======================================================
  // 🔗 Build Edges
  // ======================================================
  useEffect(() => {
    if (!cleanedFlowData?.nodes) return;

    const genEdges = [];
    cleanedFlowData.nodes.forEach((n) => {
      if (n.data?.options?.length) {
        n.data.options.forEach((targetId) =>
          genEdges.push({ source: n.id, target: normalizeId(targetId) })
        );
      }
      if (n.data?.next) {
        genEdges.push({ source: n.id, target: normalizeId(n.data.next) });
      }
    });

    setEdges(genEdges);
  }, [cleanedFlowData]);

  // ======================================================
  // 🧭 Gameplay logic
  // ======================================================
  useEffect(() => {
    setStartTime(Date.now());
  }, [currentNodeId]);

  if (!cleanedFlowData?.nodes?.length) {
    return (
      <div className="error-container">
        ⚠️ No scenario found.
        <button onClick={() => navigate("/scene-editor")}>Return to Editor</button>
      </div>
    );
  }

  // ✅ Safely get current node
  const currentNode =
    cleanedFlowData.nodes.find((n) => n.id === currentNodeId) ||
    cleanedFlowData.nodes[0];

console.log("🎬 start node:", currentNodeId, currentNode);

  if (!currentNode) {
    console.warn(`⚠️ Node '${currentNodeId}' not found, resetting to start node.`);
    // setCurrentNodeId(cleanedFlowData.startNodeId || cleanedFlowData.nodes[0]?.id);
    setCurrentNodeId(
  cleanedFlowData.startNodeId ? normalizeId(cleanedFlowData.startNodeId) :
  cleanedFlowData.nodes.find(n => n.id === "101")?.id ||
  cleanedFlowData.nodes[0]?.id ||
  null
);
    return null;
  }

  const { data_description = "", options = [], next, imageUrl, scene } = currentNode.data;
  const isEndNode = options.length === 0 && !next;

  // ======================================================
  // 🎮 Player actions
  // ======================================================
  const handleOptionClick = (optionId) => {
    const nextNode = cleanedFlowData.nodes.find((n) => n.id === normalizeId(optionId));

    if (!nextNode) {
      const available = cleanedFlowData.nodes.map((n) => n.id);
      console.error(
        `❌ Can't find node "${optionId}" from "${currentNodeId}". Available IDs:`,
        available
      );
      alert(`Can't find node "${optionId}". Check if it exists in saved flow.`);
      return;
    }

    const timeTaken = (Date.now() - startTime) / 1000;
    setChoiceHistory((prev) => [
      ...prev,
      { from: currentNodeId, to: optionId, text: data_description, timeTaken },
    ]);

    if (onOptionSelect) onOptionSelect(nextNode, timeTaken);
    setCurrentNodeId(normalizeId(optionId));
  };

  const handleNext = () => {
    if (!next) {
      console.warn(`⚠️ No 'next' node for '${currentNodeId}'`);
      return;
    }
    setChoiceHistory((prev) => [...prev, { from: currentNodeId, to: next }]);
    setCurrentNodeId(normalizeId(next));
  };

  const handleRestart = () => {
    setChoiceHistory([]);
    setCurrentNodeId(cleanedFlowData.startNodeId || cleanedFlowData.nodes[0]?.id);
  };

  const handleFinish = () => {
    localStorage.setItem("playthroughHistory", JSON.stringify(choiceHistory));
    if (onGoToReport) onGoToReport(choiceHistory);
    else navigate("/scenario-report", { state: { history: choiceHistory } });
  };

  // ======================================================
  // 🧱 Render
  // ======================================================
  return (
    <div className="playthrough-container">
      {loading && (
        <div className="loading-overlay">
          <div className="loading-box">
            <div className="spinner"></div>
            <p>Loading scenario...</p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentNodeId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="node-visual-container"
        >
          {imageUrl ? (
            <img className="node-visual" src={imageUrl} alt="Scene visual" />
          ) : (
            <div className="placeholder-image">🎬 Scene visualization unavailable</div>
          )}

          {scene && <p className="scene-text">{scene}</p>}

          <section className="promptBox">
            <h2 className="node-description">{data_description || "No description."}</h2>

            {isEndNode ? (
              <div className="end-scenario-container">
                <span className="end-scenario-heading">✅ End of Scenario</span>
                <button className="end-scenario-buttons" onClick={handleRestart}>
                  Restart
                </button>
                <button
                  className="end-scenario-buttons"
                  onClick={() => navigate("/scene-editor")}
                >
                  Back to Editor
                </button>
                <button className="end-scenario-buttons" onClick={handleFinish}>
                  View Report
                </button>
              </div>
            ) : (
              <div className="optionsWrapper">
                {options.length > 0 ? (
                  options.map((optionId) => {
                    const optionNode = cleanedFlowData.nodes.find(
                      (n) => n.id === normalizeId(optionId)
                    );
                    if (!optionNode) return null;
                    return (
                      <OptionNode
                        key={optionNode.id}
                        option={optionNode.data.data_description || optionNode.id}
                        onClick={() => handleOptionClick(optionNode.id)}
                      />
                    );
                  })
                ) : (
                  <button onClick={handleNext} className="next-button">
                    Next
                  </button>
                )}
              </div>
            )}
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ScenarioInterface;
