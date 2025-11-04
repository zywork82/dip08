import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import { FaTh, FaBars } from 'react-icons/fa';
import '../styles/CaseStudiesPage.css'; // Import the new CSS file

const getInitials = (name) => {
  if (!name) return 'A';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase(); // e.g. "Prof Andy" → "PA"
};

const CaseStudiesPage = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const navigate = useNavigate();
  const [caseStudiesData, setCaseStudiesData] = useState([]);
  const [collaboratorsData, setCollaboratorsData] = useState([]);
  const storedUser = JSON.parse(localStorage.getItem('user')) || {};
  const userName = storedUser.username || 'Admin';
  const userEmail = storedUser.email || 'admin1@example.com';
  const profileImage = storedUser.imageUrl 
    || `https://placehold.co/100x100/E6E6FA/3f51b5?text=${getInitials(userName)}`;

useEffect(() => {
  const fetchAdmins = async () => {
    try {
      const token = localStorage.getItem('token'); // JWT if needed
      const response = await fetch('http://localhost:5000/admins/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setCollaboratorsData(data || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
      setCollaboratorsData([]); // fallback
    }
  };

  fetchAdmins();
}, []);
  

  useEffect(() => {
    const fetchCaseStudies = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/scenarios");
        if (!response.ok) throw new Error("Failed to load scenarios");
        const data = await response.json();
        setCaseStudiesData(Array.isArray(data) ? data : data.scenarios || []);
      } catch (error) {
        console.error("Error fetching case studies:", error);
      }
    };
    fetchCaseStudies();
  }, []);

  const handleCreateNewCase = () => {
    navigate('/scenario');
  };

  // === Open an existing scenario
  const handleOpenScenario = async (scenario) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/scenarios/getFlow/${scenario._id}`);
      if (!response.ok) throw new Error("Scenario not found");
      const flowData = await response.json();

      if (!flowData || !flowData.nodes) {
        alert("No flow data found for this scenario.");
        return;
      }

      // ✅ Navigate based on status
      // if (scenario.status === "ImageReady") {
      //   navigate("/scene-editor", {
      //     state: { flowData, scenarioId: scenario._id },
      //   });
      // } else {
      //   navigate("/editor", {
      //     state: { flowData, scenarioId: scenario._id },
      //   });
      // }
      navigate("/scene-editor", {
  state: { flowData, scenarioId: scenario._id },
});

    } catch (err) {
      console.error("Error opening scenario:", err);
      alert("⚠️ Failed to load scenario. Please try again.");
    }
  };

  // === Filter tabs
  const filteredCaseStudies = caseStudiesData.filter((cs) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Published') return cs.status === 'Published';
    if (activeTab === 'In-Progress') return cs.status === 'In-Progress' || cs.status === 'Edit';
    return false;
  });
  
  const renderCaseStudies = () => {
    if (viewMode === 'grid') {
      return (
        <div className="cards-grid">
          {filteredCaseStudies.map((cs) => (
            <div 
              key={cs.id} 
              className="card"
            >
              <img src={cs.image} alt={cs.title} className="card-image" />
              <div className="card-content">
                <h3 className="card-title">{cs.title}</h3>
                <p className="card-date">Last edited on {cs.lastEdited}</p>
                <div className="card-footer">
                  {cs.status === 'Edit' ? (
                    <button className="edit-button">
                      Edit
                    </button>
                  ) : (
                    <span className={`status-badge status-${cs.status.replace('-', '')}`}>
                      {cs.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      return (
        <div className="cards-list">
          {filteredCaseStudies.map((cs) => (
            <div 
              key={cs.id} 
              className="list-item"
            >
              <img src={cs.image} alt={cs.title} className="list-image" />
              <div className="list-content">
                <div className="list-info">
                  <h3 className="list-title">{cs.title}</h3>
                  <p className="list-date">Last edited on {cs.lastEdited}</p>
                </div>
                <div className="list-actions">
                 {cs.status === 'Edit' ? (
  <button 
    className="edit-button"
    onClick={() => handleOpenScenario(cs)} // 👈 add this line
  >
    Edit
  </button>
) : (
  <span className={`status-badge status-${cs.status.replace('-', '')}`}>
    {cs.status}
  </span>
)}

                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="case-studies-container">
      <SharedSidebar />
      <div className="main-content">
        <SharedHeader 
          profileImage={profileImage} 
          userName={userName} 
          userEmail={userEmail}/>
        <div className="page-body">
          <div className="case-studies-section">
            <div className="banner">
              <div style={{ lineHeight: 1.5 }}>
                <span style={{ fontSize: '1rem', fontWeight: 400 }}>New to Deciwise?</span>
                <br />
                <a href="/tutorial" className="banner-link"><span className="banner-text">Begin your Tutorial</span></a>
              </div>
            </div>

            <div className="header-row">
              <h2 className="page-title">Case Studies</h2>
              <button 
                className="create-button"
                onClick={handleCreateNewCase}
                title="Create new case study"
              >
                +
              </button>
            </div>

            <div className="tab-container">
              <div className="tabs">
                {['All', 'Published', 'In-Progress'].map((tab) => (
                  <div
                    key={tab}
                    className={`tab ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </div>
                ))}
              </div>
              <div className="view-toggle">
                <FaTh 
                  className={`view-icon ${viewMode === 'grid' ? 'active' : ''}`} 
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                />
                <FaBars 
                  className={`view-icon ${viewMode === 'list' ? 'active' : ''}`} 
                  onClick={() => setViewMode('list')}
                  title="List view"
                />
              </div>
            </div>

            {renderCaseStudies()}
          </div>

          <div className="collaborator-section">
            <h3 className="collaborator-title">Collaborator List</h3>
            <div className="collaborator-list">
              {collaboratorsData.map((admin, index) => (
                <div key={index} className="collaborator-item">
                  <div className="collaborator-avatar" style={{ backgroundColor: admin.color || '#5a466dff' }}>
                    {getInitials(admin.username)}
                  </div>
                  <div className="collaborator-info">
                    <span className="collaborator-name">{admin.username}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseStudiesPage;