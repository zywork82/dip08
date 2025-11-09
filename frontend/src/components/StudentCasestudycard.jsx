import React from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const StudentCaseStudyCard = ({ title, lastEdited, status, image, scenarioId }) => {
  const navigate = useNavigate();
  const isCompleted = status === "Completed";
  const buttonLabel = isCompleted ? "Done" : "Go";
  const buttonClass = isCompleted ? "case-study-btn completed" : "case-study-btn go";

  const handleGo = async (e) => {
    e.stopPropagation(); // prevent parent click if any

    if (!scenarioId) return console.error("❌ scenarioId missing!");

    try {
      // fetch the flowData
      const res = await axios.get(`http://127.0.0.1:5000/scenarios/getFlow/${scenarioId}`);
      const flowData = res.data;

      if (!flowData || !flowData.nodes) {
        alert("⚠️ No flow data found for this scenario.");
        return;
      }

      // navigate to simulation
      navigate("/simulation", { state: { flowData, scenarioId } });
    } catch (err) {
      console.error("Failed to fetch flowData:", err);
      alert("⚠️ Failed to load scenario. Please try again.");
    }
  };

  return (
    <div className="case-study-card">
      <div className="case-study-image">
        <img
          src={image}
          alt={title}
          onError={(e) =>
            (e.target.src = "https://placehold.co/400x200/525252/FFF?text=Image+Not+Found")
          }
        />
        <div className="case-study-gradient"></div>
      </div>
      <div className="case-study-info">
        <h3 className="case-study-title">{title}</h3>
        <p className="case-study-date">Last edited on {lastEdited}</p>
        <button className={buttonClass} onClick={handleGo}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
};

export default StudentCaseStudyCard;
