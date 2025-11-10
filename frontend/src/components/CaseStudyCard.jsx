import React from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ import this

const CaseStudyCard = ({ title, lastEdited, status, image, onGoClick, scenarioId }) => {
  console.log("📦 Props received:", { title, scenarioId }); // should now show a valid ID
  const navigate = useNavigate(); // ✅ initialize navigate
  const isCompleted = status === 'Completed';
  const buttonClass = isCompleted ? 'case-study-btn completed' : 'case-study-btn in-progress';

 const handleOpenScenario = async () => {
  if (!scenarioId) return console.error("❌ scenarioId is missing");

  try {
    const response = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${scenarioId}`);
    if (!response.ok) throw new Error("Scenario not found");
    const flowData = await response.json();

    if (!flowData || !flowData.nodes) {
      alert("No flow data found for this scenario.");
      return;
    }

    navigate("/scene-editor", { state: { flowData, scenarioId } });
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
        <button
          className={buttonClass}
          onClick={(e) => {
             e.stopPropagation(); // prevent parent click
            if (!scenarioId) {
              console.error("❌ scenarioId is missing!");
              return;
            }
            handleOpenScenario();
          }}
        >
          {isCompleted ? 'Completed' : 'Go'}
        </button>
      </div>
	
    </div>
  );
};

export default CaseStudyCard;
