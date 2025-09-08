import React, { useState } from 'react';

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
    e.dataTransfer.setData("application/json", JSON.stringify(suggestion));
    e.dataTransfer.effectAllowed = "copy";
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

// New ToolCard component to represent a draggable tool
const ToolCard = ({ type, text }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type, text }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className={`tool-card ${type}`}
      draggable="true"
      onDragStart={handleDragStart}
    >
      <p>{text}</p>
    </div>
  );
};

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState('tools');

  return (
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
            <ToolCard type="scenario" text="Scenario" />
            <ToolCard type="option" text="Option" />
            <ToolCard type="popup" text="Pop-up" />
            <ToolCard type="ending" text="Ending" />
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
  );
};

export default Sidebar;
