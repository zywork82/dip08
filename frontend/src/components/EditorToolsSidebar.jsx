// src/components/EditorToolsSidebar.jsx
import React, { useState } from "react";
import "../styles/EditorToolsSidebar.css";

const nodeTypes = ["scenario", "option", "ending"];

const EditorToolsSidebar = ({
  scenarioTitle = "",
  setScenarioTitle = () => {},
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // === Handle node drag (manual node or AI suggestion) ===
  const handleDragStart = (event, nodeType, data_description) => {
    const payload = {
      nodeType,
      data: {
        data_description: data_description || `New ${nodeType}`,
        scene: "",
        options: [],
        next: null,
      },
    };
    event.dataTransfer.setData("application/reactflow", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  // === Generate AI Suggestions ===
 const handleGenerateClick = async () => {
  if (!scenarioTitle.trim()) {
    alert("Please enter a scenario title or description first.");
    return;
  }

  setLoading(true);
  setError("");

  try {
    const res = await fetch("http://127.0.0.1:5000/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: scenarioTitle }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "AI generation failed.");

    // ✅ Normalize shape here
    setSuggestions(
      (data.suggestions || []).map((s) => ({
        nodeType: s.nodeType || "option",
        data_description: s.label || s.data_description || s.text || "New Option",
      }))
    );

    console.log("✅ AI suggestions:", data.suggestions);
  } catch (err) {
    console.error("Error generating suggestions:", err);
    setError(err.message || "Something went wrong.");
  } finally {
    setLoading(false);
  }
};

  return (
    <aside className="editor-sidebar">
      {/* === Scenario Title === */}
      <div className="scenario-title">
        <span className="scenario-title-heading">Scenario Title</span>
        <input
          className="scenario-title-input"
          type="text"
          value={scenarioTitle}
          onChange={(e) => setScenarioTitle(e.target.value)}
          placeholder="Enter Scenario Title"
        />
      </div>

      {/* === Node Toolbox === */}
      <div className="node-toolbox-container">
        <span className="scenario-title-heading">Node Toolbox</span>
        {nodeTypes.map((type) => (
          <div
            key={type}
            title={`Drag to create a ${type} node`}
            className={`sidebar-node sidebar-node-${type}`}
            draggable
            onDragStart={(e) =>
              handleDragStart(e, type, `${type.charAt(0).toUpperCase() + type.slice(1)} Node`)
            }
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </div>
        ))}
      </div>

      {/* === AI Suggestions Section === */}
      <div className="ai-suggestion-section">
        <div className="suggestion-header">
          <span className="scenario-title-heading">AI Suggestions</span>
          <button
            className="ai-suggestion-button"
            onClick={handleGenerateClick}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {suggestions.map((sugg, idx) => (
          <div
            key={`sugg-${idx}`}
            className="sidebar-node sidebar-node-suggestion"
            draggable
            title={sugg.data_description || sugg.label}
onDragStart={(e) =>
  handleDragStart(
    e,
    sugg.nodeType || "option",
    sugg.data_description || sugg.label || sugg.text || "New Option"
  )
}
>
  {sugg.data_description || sugg.label || sugg.text || "Untitled"}


          </div>
        ))}
      </div>
    </aside>
  );
};

export default EditorToolsSidebar;
