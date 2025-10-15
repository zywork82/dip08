import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  // Transform backend response into React Flow format
  const transformFlowData = (data) => {
    const nodes = data.nodes.map((n, idx) => ({
      id: n.id,
      type: n.type, // "process" | "decision" | "end"
      position: { x: idx * 200, y: idx * 120 }, // placeholder, auto-layout will fix
      data: {
        label: n.text,
        narrative: n.narrative,
        scene: n.scene,
        imageUrl: n.image || null,
      },
    }));

    const edges = data.edges.map((e, idx) => ({
      id: `e-${idx}`,
      source: e.from,
      target: e.to,
      label: e.label || "",
    }));

    return { nodes, edges };
  };

  const handleSubmit = async () => {
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
        levels: [3, 3, 3, 3],
      }),
    });

    const data = await res.json();
    if (res.ok) {
      const flowData = transformFlowData(data);

      // ✅ Save scenario to localStorage before navigating
      const newScenario = {
        id: Date.now(),
        title: title || "Untitled Scenario",
        description,
        flowData,
        createdAt: new Date().toISOString(),
      };

      const existing = JSON.parse(localStorage.getItem("scenarios") || "[]");
      existing.push(newScenario);
      localStorage.setItem("scenarios", JSON.stringify(existing));

      // ✅ Then navigate to editor
      navigate("/editor", { state: { flowData } });
    } else {
      setError(data.error || "Something went wrong.");
    }
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
          <label htmlFor="scenario-title">Scenario Title:</label>
          <input
            type="text"
            id="scenario-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder=" "
          />
        </div>

        <div className="form-group">
          <label htmlFor="case-study-description">What's your scenario about?</label>
          <textarea
            id="case-study-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your scenario here...."
            maxLength="2000"
          />
          <div className="word-count">{description.length}/2000 chars</div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button
          className="create-scenario-button"
          onClick={handleSubmit}
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
  