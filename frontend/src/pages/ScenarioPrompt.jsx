import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Global.css";
import "../styles/ScenarioPrompt.css";
import NavigationBar from "../components/SlimNavBar";
import SharedHeader from "../components/SharedHeader";
import ScenarioHistory from "../components/ScenarioHistory";
import localforage from "localforage";

const profileImage = "https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg";

const ScenarioPrompt = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  // === Fake progress animation ===
  useEffect(() => {
    let timer;
    if (loading) {
      setProgress(0);
      timer = setInterval(() => {
        setProgress((p) => (p < 95 ? p + Math.random() * 8 : p));
      }, 500);
    } else {
      clearInterval(timer);
      setProgress(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  // === Transform backend JSON to frontend flow ===
  const transformFlowData = (data) => {
  const rawNodes = Array.isArray(data) ? data : Object.values(data);

  const nodes = rawNodes.map((n, idx) => ({
    id: String(n.id),
    type: n.type || "scenario",
    position: { x: (idx % 4) * 250, y: Math.floor(idx / 4) * 200 },
    data: {
      data_description: n.data_description || "",
      options: n.options || [],
      next: n.next || null,
      psych_dimensions: n.psych_dimensions || "",
      scene: n.scene || "",
      b64image: n.b64image || "",
    },
  }));

  // Build all possible edges
  const edges = [];
  nodes.forEach((node) => {
    if (Array.isArray(node.data.options)) {
      node.data.options.forEach((targetId) => {
        if (nodes.find((x) => x.id === targetId)) {
          edges.push({
            id: `e-${node.id}-${targetId}`,
            source: node.id,
            target: targetId,
            type: "smoothstep",
            animated: true,
          });
        }
      });
    }

    // fallback direct next pointer
    if (node.data.next && nodes.find((x) => x.id === node.data.next)) {
      edges.push({
        id: `e-${node.id}-${node.data.next}`,
        source: node.id,
        target: node.data.next,
        type: "smoothstep",
        animated: true,
      });
    }
  });

  // Remove duplicates
  const uniqueEdges = Array.from(new Map(edges.map((e) => [e.id, e])).values());
  return { nodes, edges: uniqueEdges };
};

  // === Smart title generator ===
  const generateSmartTitle = (text) => {
    if (!text.trim()) return "Untitled Scenario";
    const firstWords = text.split(" ").slice(0, 5).join(" ");
    const formatted = firstWords.charAt(0).toUpperCase() + firstWords.slice(1);
    return formatted.replace(/[^\w\s]/gi, "");
  };

  // === Create & Generate Scenario ===
  const handleCreateAndSave = async () => {
    if (!title.trim() && !description.trim()) {
      setError("Please provide at least a title or description before generating.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Auto-generate title if blank
      const finalTitle = title.trim() ? title : generateSmartTitle(description);

      // Reuse existing empty draft if it exists
      let existingDraft = JSON.parse(localStorage.getItem("latestDraft") || "null");
      let scenarioId = existingDraft?._id;

      if (!existingDraft || existingDraft.title !== finalTitle) {
        const createRes = await fetch("http://127.0.0.1:5000/scenarios/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: finalTitle,
            description,
            status: "Draft",
          }),
        });

        const createData = await createRes.json();
        if (!createData.success) throw new Error(createData.error || "Failed to create scenario");
        existingDraft = createData.scenario;
        scenarioId = existingDraft._id;
        localStorage.setItem("latestDraft", JSON.stringify(existingDraft));
      }

      // === Generate Flow from AI ===
// === Generate Flow from AI ===
const genRes = await fetch("http://127.0.0.1:5000/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ story: description, psych_seed: 42 }),
});

const genData = await genRes.json();
console.log("🧪 Raw backend response:", genData);

if (!genRes.ok) throw new Error(genData.error || "AI generation failed");

// ✅ Declare flowData before using it
const flowData = transformFlowData(genData);
console.log("🧪 Transformed flowData:", flowData);


      const newScenario = {
        id: scenarioId,
        title: finalTitle,
        description,
        flowData,
        status: "Draft",
        createdAt: new Date().toISOString(),
        lastEdited: new Date().toISOString(),
        image: null,
      };

      // Save to localStorage for ScenarioHistory
     // Save small metadata in localStorage (lightweight)
const existing = JSON.parse(localStorage.getItem("scenarios") || "[]");
const existingIndex = existing.findIndex((s) => s.id === scenarioId);
if (existingIndex >= 0) existing[existingIndex] = newScenario;
else existing.push(newScenario);
localStorage.setItem("scenarios", JSON.stringify(existing));
localStorage.setItem("lastScenarioTitle", finalTitle);
localStorage.setItem("lastScenarioId", scenarioId);

// 🧠 Save large flow data safely in IndexedDB
await localforage.setItem("latestFlow", flowData);
console.log("✅ Flow data cached in IndexedDB");

// Navigate to editor
navigate("/editor", {
  state: { flowData, scenarioTitle: newScenario.title, scenarioId },
});

    } catch (err) {
      console.error("Error generating scenario:", err);
      setError("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scenario-prompt-page">
      <NavigationBar />
      <div className="scenario-prompt-container">
        <div className="header">
        </div>

        <div className="scenario-prompt-content">
          <div className="scenerio-history-container">
            <ScenarioHistory />
          </div>

          <div className="content-area">
            <div className="form-group">
              <span className="scenario-title-header">Scenario Title:</span>
              <input
                className="scenario-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name the scenario..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="case-study-description">What's your scenario about?</label>
              <div className="description-input-container">
                <textarea
                  id="case-study-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your scenario here..."
                />
              </div>
              <div className="word-count">{description.length}/2000 chars</div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button
              className={`create-scenario-button ${loading ? "loading" : ""}`}
              onClick={handleCreateAndSave}
              disabled={loading}
            >
              {loading ? "Generating..." : "Create Scenario"}
            </button>
          </div>
        </div>
      </div>

      {/* === AI Loading Overlay === */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-box">
            <div className="spinner"></div>
            <p className="loading-text">AI is generating your flowchart...</p>
            <div className="progress-bar">
              <div className="progress" style={{ width: `${progress}%` }}></div>
            </div>
            <small>Estimated time: about 1–2 minutes</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioPrompt;
