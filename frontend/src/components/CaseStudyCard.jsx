import React from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ import this

const CaseStudyCard = ({ title, lastEdited, status, image, onGoClick, scenarioId }) => {
  console.log("📦 Props received:", { title, scenarioId }); // should now show a valid ID
  const navigate = useNavigate(); // ✅ initialize navigate
  const isCompleted = status === 'Completed';
  const buttonClass = isCompleted ? 'case-study-btn completed' : 'case-study-btn in-progress';

  const handleOpenScenario = () => {
    if (!scenarioId) {
      console.error("❌ scenarioId is missing!");
      return;
    }
    navigate("/editor", { state: { scenarioId, title } });
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
          onClick={() => {
            if (!scenarioId) {
              console.error("❌ scenarioId is missing!");
              return;
            }
            navigate('/editor', { state: { scenarioId, title } }) // ✅ scenarioId now defined
          }}
        >
          {isCompleted ? 'Completed' : 'Go'}
        </button>
      </div>
	
    </div>
  );
};

export default CaseStudyCard;
