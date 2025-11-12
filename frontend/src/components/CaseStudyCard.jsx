import React from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ import this

const CaseStudyCard = ({ title, lastEdited, status, image, onGoClick, scenarioId }) => {
  // console.log("📦 Props received:", { title, scenarioId }); // should now show a valid ID
  const navigate = useNavigate(); // ✅ initialize navigate
  const isCompleted = status === 'Completed';
  const buttonClass = isCompleted ? 'case-study-btn completed' : 'case-study-btn in-progress';

 const handleOpenScenario = async (e) => {
  e?.stopPropagation?.(); // prevent duplicate triggers if needed
  if (!scenarioId) return console.error("❌ scenarioId is missing");

  try {
    const response = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${scenarioId}`);
    if (!response.ok) throw new Error("Scenario not found");

    const flowData = await response.json();
    if (!flowData || !flowData.nodes) {
      alert("No flow data found for this scenario.");
      return;
    }

    // ✅ Clear any stale editor cache before navigating
    localStorage.removeItem("latestFlow");
    localStorage.removeItem("lastScenarioTitle");

    // ✅ Save the new scenario ID and title for the editor to pick up
    localStorage.setItem("lastScenarioId", scenarioId);
    if (title) localStorage.setItem("lastScenarioTitle", title);

    // ✅ Route user based on scenario status
    const currentStatus = (flowData.status || "").toLowerCase();
    console.log("🧭 Scenario status:", currentStatus);

    if (["draft", "flowchart"].includes(currentStatus)) {
      navigate("/editor", { state: { flowData, scenarioId, scenarioTitle: title } });
    } else if (currentStatus === "images") {
      navigate("/scene-editor", { state: { flowData, scenarioId, scenarioTitle: title } });
    } else if (currentStatus === "published") {
      navigate("/simulation", { state: { flowData, scenarioId, scenarioTitle: title } });
    } else {
      alert("⚠️ Unknown scenario status — opening FlowChartEditor by default.");
      navigate("/editor", { state: { flowData, scenarioId, scenarioTitle: title } });
    }
  } catch (err) {
    console.error("Error opening scenario:", err);
    alert("⚠️ Failed to load scenario. Please try again.");
  }
};


  return (
    <div className="case-study-card" onClick={handleOpenScenario}>
      <div className="case-study-image">
        <img src={image} alt={title} onError={(e) => e.target.src = 'https://placehold.co/400x200/525252/FFF?text=Image+Not+Found'} />
        <div className="case-study-gradient"></div>
      </div>
      <div className="case-study-info">
        <h3 className="case-study-title">{title}</h3>
        <p className="case-study-date">Last edited on {lastEdited}</p>
    <p
  className="case-study-status"
  style={{
    color:
      (status || "").toLowerCase() === "published" ? "#4CAF50" :
      (status || "").toLowerCase() === "images" ? "#FF9800" :
      (status || "").toLowerCase() === "flowchart" ? "#2196F3" :
      "#9E9E9E",
  }}
>
  {(status || "draft").toUpperCase()}
</p>
<button
  className={buttonClass}
  onClick={(e) => {
    e.stopPropagation();
    handleOpenScenario();
  }}
>
  {status === "draft" ? "Build Flow" :
   status === "flowchart" ? "Add Images" :
   status === "images" ? "Play Test" :
   status === "published" ? "View" :
   "Go"}
</button>

      </div>
	
    </div>
  );
};

export default CaseStudyCard;
