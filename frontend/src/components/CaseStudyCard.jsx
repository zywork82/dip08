import React from 'react';

const CaseStudyCard = ({ title, status, lastEdited, image }) => {
  const isCompleted = status === 'Completed';
  const buttonClass = isCompleted ? 'case-study-btn completed' : 'case-study-btn in-progress';
  return (
    <div className="case-study-card">
      <div className="case-study-image">
        <img src={image} alt={title} onError={(e) => e.target.src = 'https://placehold.co/400x200/525252/FFF?text=Image+Not+Found'} />
        <div className="case-study-gradient"></div>
      </div>
      <div className="case-study-info">
        <h3 className="case-study-title">{title}</h3>
        <p className="case-study-date">Last attempted on {lastEdited}</p>
        <button className={buttonClass}>
          {isCompleted ? 'Completed' : 'Go'}
        </button>
      </div>
    </div>
  );
};

export default CaseStudyCard;
