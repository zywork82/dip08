import React from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit } from "react-icons/fa";

const CaseStudyCard = ({
  title,
  lastEdited,
  status,
  image,
  scenarioId,
  onDeleteSuccess,
  onRenameSuccess,  
}) => {
  const navigate = useNavigate();

  // ------------------------------------------
  // DELETE SCENARIO
  // ------------------------------------------
  const handleDelete = async (e) => {
    e.stopPropagation();

    if (!scenarioId) return alert("No scenarioId provided.");

    const confirmDelete = window.confirm(
      `Delete scenario "${title}"?\nThis cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(
        `http://127.0.0.1:5000/scenarios/delete/${scenarioId}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (data.success) {
        alert("Scenario deleted successfully.");
        onDeleteSuccess && onDeleteSuccess(scenarioId);
      } else {
        alert("Failed to delete scenario.");
      }
    } catch (err) {
      console.error("❌ Delete error:", err);
      alert("Error deleting scenario.");
    }
  };

  // ------------------------------------------
  // OPEN SCENARIO BASED ON STATUS
  // ------------------------------------------
  const handleOpenScenario = async () => {
    if (!scenarioId) return console.error("❌ scenarioId missing");

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/scenarios/getFlow/${scenarioId}`
      );

      if (!response.ok) throw new Error("Scenario not found");
      const flowData = await response.json();

      // Save for editor
      localStorage.removeItem("latestFlow");
      localStorage.removeItem("lastScenarioTitle");

      localStorage.setItem("lastScenarioId", scenarioId);
      if (title) localStorage.setItem("lastScenarioTitle", title);

      const currentStatus = (flowData.status || "").toLowerCase();

      // ----------------------
      // NAVIGATION RULES
      // ----------------------
      if (currentStatus === "draft") {
        return navigate("/scenario", {
          state: { flowData, scenarioId, scenarioTitle: title },
        });
      }

      if (currentStatus === "flowchart") {
        return navigate("/editor", {
          state: { flowData, scenarioId, scenarioTitle: title },
        });
      }

      if (currentStatus === "images") {
        return navigate("/scene-editor", {
          state: { flowData, scenarioId, scenarioTitle: title },
        });
      }

      if (currentStatus === "published") {
        return navigate("/simulation", {
          state: { flowData, scenarioId, scenarioTitle: title },
        });
      }

      // Fallback
      return navigate("/editor", {
        state: { flowData, scenarioId, scenarioTitle: title },
      });
    } catch (err) {
      console.error("Error opening scenario:", err);
      alert("⚠️ Failed to load scenario.");
    }
  };

  return (
    <div className="case-study-card" onClick={handleOpenScenario}>
      {/* Small delete button */}
      <div
        onClick={handleDelete}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 5,
          cursor: "pointer",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "12px",
        }}
      >
        ✕
      </div>

      <div className="case-study-image">
        <img
          src={image}
          alt={title}
          onError={(e) =>
            (e.target.src =
              "https://placehold.co/400x200/525252/FFF?text=Image+Not+Found")
          }
        />
        <div className="case-study-gradient"></div>
      </div>

      <div className="case-study-info">
        <h3 className="case-study-title">{title}</h3>
        <p className="case-study-date">Last edited on {lastEdited}</p>

        <p
          className="case-study-status"
          style={{
            color:
              (status || "").toLowerCase() === "published"
                ? "#4CAF50"
                : (status || "").toLowerCase() === "images"
                ? "#FF9800"
                : (status || "").toLowerCase() === "flowchart"
                ? "#2196F3"
                : "#9E9E9E",
                marginBottom: "5px",
          }}
        >
          {(status || "draft").toUpperCase()}
        </p>
          <button
  className="case-study-btn rename"
  style={{position: "relative",left: "230px",
    marginBottomwidth: "30px", height: "30px",width: "30px",borderRadius: "50%", 
    paddingBottom: "10px",marginBottom: "5px",
  }}
  onClick={(e) => {
    e.stopPropagation();
    const newTitle = prompt("Enter new title:", title);
    if (!newTitle) return;

    fetch(`http://localhost:5000/scenarios/rename/${scenarioId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        onRenameSuccess(scenarioId, newTitle);
      } else {
        alert("Rename failed.");
      }
    });
  }}
>
   <FaEdit size={14} style={{position: "relative",right: "5px"}} />
</button>

        <button
          className="case-study-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenScenario();
          }}
        >
          {status === "draft"
            ? "Build Flow"
            : status === "flowchart"
            ? "Add Images"
            : status === "images"
            ? "Play Test"
            : status === "published"
            ? "View"
            : "Go"}
        </button>
      </div>
    </div>
  );
};

export default CaseStudyCard;
