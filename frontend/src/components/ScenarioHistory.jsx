import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ScenarioHistory.css";

const ScenarioHistory = () => {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tempTitle, setTempTitle] = useState("");
  const navigate = useNavigate();

  // === Fetch all scenarios ===
  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/scenarios/");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const mapped = data
          .map((s) => ({ ...s, id: s.id || s._id }))
          .sort((a, b) => new Date(b.lastEdited) - new Date(a.lastEdited));

        setScenarios(mapped || []);
        localStorage.setItem("scenarios", JSON.stringify(mapped));
      } catch (err) {
        console.error("❌ Failed to fetch scenarios:", err);
        const stored = JSON.parse(localStorage.getItem("scenarios") || "[]");
        setScenarios(stored.length > 0 ? stored : []);
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  }, []);

  // === Click outside closes dropdown and rename ===
  useEffect(() => {
    const handleClickOutside = () => {
      setMenuOpen(null);
      setEditingId(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // === Delete scenario ===
 const handleDelete = async (id) => {
  if (!window.confirm("Delete this scenario and all its nodes?")) return;

  try {
    const res = await fetch(`http://127.0.0.1:5000/scenarios/delete/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();

    if (data.success) {
      console.log(`🗑 Deleted scenario ${id}:`, data);
      const updated = scenarios.filter((s) => s.id !== id);
      setScenarios(updated);
      localStorage.setItem("scenarios", JSON.stringify(updated));
      setMenuOpen(null);
      alert(`✅ Deleted ${data.nodesDeleted} nodes.`);
    } else {
      alert("⚠️ Delete failed: " + data.error);
    }
  } catch (err) {
    console.error("❌ Delete failed:", err);
    alert("Failed to connect to backend.");
  }
};

  // === Open scenario ===
  const handleOpen = async (scenario) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:5000/scenarios/getFlow/${scenario.id}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const flowData = await res.json();

      if (!flowData.edges || flowData.edges.length === 0) {
        flowData.edges = generateEdgesFromNodes(flowData.nodes || []);
      }

      navigate("/editor", {
        state: {
          flowData,
          scenarioTitle: scenario.title,
        },
      });
    } catch (err) {
      console.error("❌ Error loading scenario flow:", err);
      alert("Failed to load scenario from backend.");
    }
  };

  // === Helper to generate edges ===
  const generateEdgesFromNodes = (nodes) => {
    const edges = [];
    nodes.forEach((node) => {
      const data = node.data || {};
      if (node.type === "scenario" && data.options?.length) {
        data.options.forEach((optId) => {
          if (nodes.find((n) => n.id === optId)) {
            edges.push({
              id: `e-${node.id}-${optId}`,
              source: node.id,
              target: optId,
              type: "smoothstep",
              animated: true,
            });
          }
        });
      }
      if (node.type === "option" && data.next) {
        if (nodes.find((n) => n.id === data.next)) {
          edges.push({
            id: `e-${node.id}-${data.next}`,
            source: node.id,
            target: data.next,
            type: "smoothstep",
            animated: true,
          });
        }
      }
    });
    return edges;
  };

  // === Rename functions ===
  const handleRenameClick = (scenario) => {
    setEditingId(scenario.id);
    setTempTitle(scenario.title);
    setMenuOpen(null);
  };

  const handleRenameSubmit = async (id) => {
    if (!tempTitle.trim()) return;

    const updated = scenarios.map((s) =>
      s.id === id ? { ...s, title: tempTitle } : s
    );
    setScenarios(updated);
    setEditingId(null);

    localStorage.setItem("scenarios", JSON.stringify(updated));

    // Optional: update backend
    try {
      await fetch(`http://127.0.0.1:5000/scenarios/saveFlow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: tempTitle,
          status: "Edit",
          lastEdited: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn("⚠️ Rename saved locally, but failed to update backend:", err);
    }
  };

  return (
    <div className="scenario-history">
      <p className="scenario-history-title">Scenario History</p>

      {loading ? (
        <p className="loading">Loading scenarios...</p>
      ) : scenarios.length === 0 ? (
        <p className="empty">No scenarios found.</p>
      ) : (
         <div className="scrollable-list">
        <ul className="history-list">
          {scenarios.map((s) => (
            <li key={s.id} className="history-item" onClick={(e) => e.stopPropagation()}>
              <div className="text-content">
                {editingId === s.id ? (
                  <input
                    className="rename-input"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={() => handleRenameSubmit(s.id)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleRenameSubmit(s.id)
                    }
                    autoFocus
                  />
                ) : (
                  <button className="history-title" onClick={() => handleOpen(s)}>
                    {s.title || "Untitled Scenario"}
                  </button>
                )}

                {/* ⋯ dropdown menu */}
                <div className="menu-container">
                  <button
                    className="menu-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === s.id ? null : s.id);
                    }}
                  >
                    ⋯
                  </button>

                  {menuOpen === s.id && (
                    <div
                      className="dropdown-menu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button className="menu-item">Share</button>
                      <button
                        className="menu-item"
                        onClick={() => handleRenameClick(s)}
                      >
                        Rename
                      </button>
                      <button className="menu-item">Archive</button>
                      <button
                        className="menu-item delete"
                        onClick={() => handleDelete(s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
{/* 
              <div className="meta-info">
                <small>
                  🕒 {s.lastEdited ? s.lastEdited.slice(0, 10) : "Unknown"}
                </small>
                <span
                  className={`status-tag ${s.status?.toLowerCase() || "draft"}`}
                >
                  {s.status}
                </span>
              </div> */}
            </li>
          ))}
        </ul></div>
      )}
    </div>
  );
};

export default ScenarioHistory;
