import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Global.css";
import "../styles/ScenarioPrompt.css";
import NavigationBar from '../components/SlimNavBar';
import SharedHeader from '../components/SharedHeader';
import ScenarioHistory from "../components/ScenarioHistory";


// Placeholder for the profile image
const profileImage = 'https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg';
const ScenarioPrompt = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Transform backend flat JSON into React Flow nodes & edges
  const transformFlowData = (data) => {
    const nodes = Object.values(data).map((n, idx) => ({
      id: n.id,
      type: n.type,
      position: { x: idx * 200, y: idx * 120 },
      data: {
        label: n.description || n.data || '',
        narrative: n.data || '',
        options: n.options || [],
        psych_dimensions: n.psych_dimensions || '',
        scene: n.scene || '',
        imageUrl: n.b64image || null,
      },
    }));

    // Generate edges from node options
    const edges = [];
    nodes.forEach((node) => {
      node.data.options.forEach((optId) => {
        edges.push({
          id: `e-${node.id}-${optId}`,
          source: node.id,
          target: optId,
          type: "smoothstep",
          animated: true,
        });
      });
    });

    return { nodes, edges };
  };

  // Save scenario to local file
  const handleSaveClick = async (newScenario) => {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `${newScenario.title.replace(/\s+/g, "_")}_${newScenario.id}.json`,
        types: [{ description: "JSON File", accept: { "application/json": [".json"] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(newScenario, null, 2));
      await writable.close();
      console.log("✅ Scenario saved successfully");
    } catch (err) {
      console.warn("User cancelled file save or save failed", err);
    }
  };

  // Main create & save flow
  const handleCreateAndSave = async () => {
    if (!description.trim()) {
      setError("Please enter a scenario description.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:5000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story: description,
          psych_seed: 42, // optional deterministic aspects
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      const flowData = transformFlowData(data);

      const newScenario = {
        id: Date.now(),
        title: title || "Untitled Scenario",
        description,
        flowData,
        createdAt: new Date().toISOString(),
      };

      // Save to localStorage
      const existing = JSON.parse(localStorage.getItem("scenarios") || "[]");
      existing.push(newScenario);
      localStorage.setItem("scenarios", JSON.stringify(existing));

      // Save to file
      await handleSaveClick(newScenario);

      // Navigate to editor
      navigate("/editor", { state: { flowData, scenarioTitle: title || "Untitled Scenario" } });


    } catch (err) {
      setError("Failed to connect to backend: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scenario-prompt-page">
      <NavigationBar /> 
      <div className="scenario-prompt-container">
        <div className="header">
          <SharedHeader profileImage={profileImage} userName="Prof Andy" userRole="Administrator" />
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
                  placeholder="Describe your scenario here...."
                />
              </div>
              <div className="word-count">{description.length}/2000 chars</div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button
              className="create-scenario-button"
              onClick={handleCreateAndSave}
              disabled={loading}
            >
              {loading ? "Generating..." : "Create Scenario"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenarioPrompt;
