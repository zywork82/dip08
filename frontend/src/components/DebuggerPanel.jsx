// src/components/DebuggerPanel.jsx
import React from "react";

const DebuggerPanel = ({
  debugOpen,
  setDebugOpen,
  selectedNodeId,
  nodes,
  edges,
}) => {
  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setDebugOpen(true)}
        style={{
          position: "fixed",
          bottom: "100px",
          right: "40px",
          background: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "48px",
          height: "48px",
          fontSize: "22px",
          cursor: "pointer",
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          zIndex: 1500,
        }}
        title="Open Path Debugger"
      >
        🧭
      </button>

      {/* Panel */}
      <div
        className="floating-debugger"
        style={{
          position: "fixed",
          top: 0,
          right: debugOpen ? 0 : "-400px",
          width: "400px",
          height: "100%",
          background: "#1e1e1e",
          color: "white",
          transition: "right 0.3s ease",
          padding: "20px",
          overflowY: "auto",
          boxShadow: debugOpen ? "0 0 20px rgba(0,0,0,0.4)" : "none",
          zIndex: 2000,
        }}
      >
        <button
          onClick={() => setDebugOpen(false)}
          style={{
            position: "absolute",
            top: "10px",
            right: "0px",
            width: "40px",
            height: "40px",
            borderRadius: "8px 0 0 8px",
            background: "#ff0072",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        <h3>🧭 Path Debugger</h3>

        {selectedNodeId ? (
          <div>
            <p><strong>ID:</strong> {selectedNodeId}</p>
            <p><strong>Label:</strong> {nodes.find((n) => n.id === selectedNodeId)?.data?.data_description || "(no description)"}</p>
            <p><strong>Type:</strong> {nodes.find((n) => n.id === selectedNodeId)?.type}</p>
          </div>
        ) : (
          <p>No node selected</p>
        )}

        <h4>Connections</h4>
        <ul>
          {edges.map((e) => (
            <li key={e.id}>
              {e.source} → {e.target}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default DebuggerPanel;
