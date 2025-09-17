import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Global.css";
import "../styles/ScenarioPrompt.css";

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
        navigate("/scene-editor", { state: { flowData } });
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
    <div className="create-scenario-page">
      <div className="header-bar">
        <Link to="/admin" className="back-link">
          <span className="back-arrow">&lt; back</span>
        </Link>
        <span className="page-title">Scenario Prompt</span>
        <button className="edit-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
        </button>
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
          <label htmlFor="case-study-description">Describe Case Study</label>
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
          className="create-button"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Generating..." : "Create Scenario"}
        </button>
      </div>
    </div>
  );
};

export default ScenarioPrompt;
  