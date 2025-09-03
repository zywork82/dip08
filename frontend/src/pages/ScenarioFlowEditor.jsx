import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Global.css'; // For general layout and typography
import '../styles/ScenarioFlowEditor.css'; // For specific editor styles

// Mock data for the suggestions section
const suggestions = [
  {
    id: 1,
    text: "Club member spreaded the viral post on his/her social media. How would you deal with this member?",
  },
  {
    id: 2,
    text: "SAO summons you for a talk regarding the viral post. What would you do?",
  },
  {
    id: 3,
    text: "Option A: Attend and tell SAO truthfully what happen, assist them in all ways possible.",
  },
  {
    id: 4,
    text: "Option B: Ignore SAO, take the matter into your own hands",
  },
  {
    id: 5,
    text: "Option C: Don't do anything, just let the post die down",
  },
  {
    id: 6,
    text: "Your club members are worried and constantly chasing you for answers. What would you do?",
  },
];

// Component to display a single suggestion card that is now draggable
const SuggestionCard = ({ suggestion }) => {
  const handleDragStart = (e) => {
    // Set the data to be transferred during the drag operation
    e.dataTransfer.setData("text/plain", JSON.stringify(suggestion));
  };

  return (
    <div
      className="suggestion-card"
      draggable="true"
      onDragStart={handleDragStart}
    >
      <p>{suggestion.text}</p>
    </div>
  );
};

const ScenarioFlowEditor = () => {
  const [activeTab, setActiveTab] = useState('tools');
  const [nodes, setNodes] = useState([]);

  // Handler for when a draggable item is dropped
  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (data) {
      const droppedSuggestion = JSON.parse(data);
      const newNode = {
        id: droppedSuggestion.id,
        text: droppedSuggestion.text,
      };
      setNodes([...nodes, newNode]);
    }
  };

  // Handler to allow for dropping
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="flow-editor-page-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="menu-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <span className="sidebar-title">Scenario Flow Editor</span>
          <button className="edit-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
        </div>
        <div className="sidebar-tabs">
          <button 
            className={`tab ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            Tools
          </button>
          <button 
            className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            Suggestions
          </button>
        </div>
        <div className="sidebar-content">
          {activeTab === 'tools' ? (
            <div className="tools-grid">
              <div className="tool-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40" className="tool-icon">
                  <rect x="5" y="5" width="90" height="30" rx="15" fill="#e6e6fa" stroke="#3f51b5" strokeWidth="2" />
                  <text x="50" y="25" dominantBaseline="middle" textAnchor="middle" fill="#3f51b5" fontSize="12" fontWeight="bold">Scenario</text>
                </svg>
              </div>
              <div className="tool-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40" className="tool-icon">
                  <rect x="5" y="5" width="90" height="30" rx="15" fill="#e6e6fa" stroke="#3f51b5" strokeWidth="2" />
                  <text x="50" y="25" dominantBaseline="middle" textAnchor="middle" fill="#3f51b5" fontSize="12" fontWeight="bold">Option</text>
                </svg>
              </div>
              <div className="tool-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40" className="tool-icon">
                  <rect x="5" y="5" width="90" height="30" rx="15" fill="#e6e6fa" stroke="#3f51b5" strokeWidth="2" />
                  <text x="50" y="25" dominantBaseline="middle" textAnchor="middle" fill="#3f51b5" fontSize="12" fontWeight="bold">Pop-up</text>
                </svg>
              </div>
              <div className="tool-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40" className="tool-icon">
                  <rect x="5" y="5" width="90" height="30" rx="15" fill="#e6e6fa" stroke="#3f51b5" strokeWidth="2" />
                  <text x="50" y="25" dominantBaseline="middle" textAnchor="middle" fill="#3f51b5" fontSize="12" fontWeight="bold">Ending</text>
                </svg>
              </div>
            </div>
          ) : (
            <div className="suggestions-list">
              <h3 className="section-heading">Possible Scenarios</h3>
              {suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="main-editor-area">
        <div className="editor-header">
          <div className="plan-tabs">
            <button className="plan-tab active">Plan 1</button>
            <button className="plan-tab">Plan 2</button>
            <button className="add-plan-button">+</button>
          </div>
          <div className="editor-title-container">
            <h1 className="editor-title">Viral Post Handling</h1>
            <div className="title-underline"></div>
          </div>
          <div className="editor-actions">
            <button className="action-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button className="action-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2z"></path>
                <path d="M5 19V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"></path>
              </svg>
            </button>
            <button className="action-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </button>
            <button className="action-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </button>
            <button className="action-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5l9 5.5 9-5.5"></path>
                <path d="M3 14.5l9 5.5 9-5.5"></path>
                <path d="M3 19.5l9 5.5 9-5.5"></path>
              </svg>
            </button>
          </div>
        </div>
        <div 
          className="canvas-area"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="flowchart-container">
            <div className="flowchart-node">
              A viral post have been spreading around. You just saw the post what is your first move?
            </div>
            <div className="flowchart-options-container">
              <div className="flowchart-node">
                OPTION A: Ignore it and hope it dies down.
              </div>
              <div className="flowchart-node">
                OPTION B: Alert your Exco and call for an emergency meeting.
              </div>
              <div className="flowchart-node">
                OPTION C: Report the post to the platform and request removal.
              </div>
            </div>
            {nodes.map((node) => (
              <div key={node.id} className="flowchart-node">
                {node.text}
              </div>
            ))}
          </div>
        </div>
        <div className="editor-footer">
          <button className="editor-button save-button">Save changes</button>
          <button className="editor-button generate-button">Generate Simulation</button>
        </div>
      </div>
    </div>
  );
};

export default ScenarioFlowEditor;
