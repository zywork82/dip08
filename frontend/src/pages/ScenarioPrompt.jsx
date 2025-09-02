import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Global.css'; // Assuming you'll have global styles
import '../styles/ScenarioPrompt.css'; // Specific styles for this page

const ScenarioPrompt = () => {
  return (
    <div className="create-scenario-page">
      <div className="header-bar">
        <Link to="/admin" className="back-link">
          <span className="back-arrow">&lt; back</span>
        </Link>
        <span className="page-title">Scenario Prompt</span>
        <button className="edit-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
        </button>
      </div>
      <div className="content-area">
        <div className="form-group">
          <label htmlFor="scenario-title">Scenario Title:</label>
          <input type="text" id="scenario-title" placeholder=" " />
        </div>
        <div className="form-group">
          <label htmlFor="case-study-description">Describe Case Study</label>
          <textarea id="case-study-description" placeholder="Describe your scenario here...." maxLength="2000"></textarea>
          <div className="word-count">0/2000 words</div>
        </div>
        <button className="create-button">Create Scenario</button>
      </div>
    </div>
  );
};

export default ScenarioPrompt;
