import React, { useEffect, useState } from "react";
import "../styles/ScenarioHistory.css";

const ScenarioHistory = () => {
  const [scenarios, setScenarios] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("scenarios") || "[]");
    if (stored.length > 0) {
      setScenarios(stored);
    } else {
      setScenarios(sampleScenarios);
    }
  }, []);

  const handleDelete = (id) => {
    const updated = scenarios.filter((s) => s.id !== id);
    setScenarios(updated);
    localStorage.setItem("scenarios", JSON.stringify(updated));
  };

  const handleOpen = (scenario) => {
    alert(`Open scenario: ${scenario.title}`);
  };

  return (
    <div className="scenario-history">
      <h3>Scenario History</h3>
      {scenarios.length === 0 ? (
        <p className="empty">No scenarios yet.</p>
      ) : (
        <ul className="history-list">
          {scenarios.map((s) => (
            <li key={s.id} className="history-item">
              <div className="text-content">
                <button className="history-title"onClick={() => handleOpen(s)}>{s.title}</button><span className="link delete" onClick={() => handleDelete(s.id)}>x</span>
                {/* <span className="desc">{s.description}</span> */}
                {/* <span className="timestamp">
                  {new Date(s.createdAt).toLocaleString()}
                </span> */}
              </div>
                
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const sampleScenarios = [
  {
    id: 1,
    title: "Viral Post Crisis",
    description: "A viral post spreads misinformation about your organization.",
    createdAt: "2025-10-10T10:00:00Z",
  },
  {
    id: 2,
    title: "Power Outage During Event",
    description: "Your school event experiences a sudden blackout.",
    createdAt: "2025-10-08T14:30:00Z",
  },
  {
    id: 3,
    title: "Unexpected Guest Visit",
    description: "A government official visits your club without notice.",
    createdAt: "2025-10-05T09:00:00Z",
  },
];

export default ScenarioHistory;
