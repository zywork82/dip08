import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import { FaTh, FaBars } from 'react-icons/fa';
import '../styles/CaseStudiesPage.css'; // Import the new CSS file

// Mock data for case studies
const caseStudiesData = [
  {
    id: 1,
    title: 'Viral Post Handling',
    lastEdited: '27/8/2025',
    status: 'Edit',
    image: 'https://onlinesafetyhub.safeguardingni.org/wp-content/uploads/2023/11/online-bullying5.jpg'
  },
  {
    id: 2,
    title: 'Missing Funds',
    lastEdited: '27/8/2025',
    status: 'Completed',
    image: 'https://onlinesafetyhub.safeguardingni.org/wp-content/uploads/2023/11/online-bullying5.jpg'
  },
  {
    id: 3,
    title: 'Online Bullying',
    lastEdited: '27/8/2025',
    status: 'In-Progress',
    image: 'https://onlinesafetyhub.safeguardingni.org/wp-content/uploads/2023/11/online-bullying5.jpg'
  },
  {
    id: 4,
    title: 'Workplace Harassment',
    lastEdited: '27/8/2025',
    status: 'In-Progress',
    image: 'https://onlinesafetyhub.safeguardingni.org/wp-content/uploads/2023/11/online-bullying5.jpg'
  },
  {
    id: 5,
    title: 'Crisis Management',
    lastEdited: '27/8/2025',
    status: 'Completed',
    image: 'https://onlinesafetyhub.safeguardingni.org/wp-content/uploads/2023/11/online-bullying5.jpg'
  },
];

// Mock data for collaborators
const collaboratorsData = [
  { initials: 'HP', color: '#9B50E5' },
  { initials: 'SH', color: '#2ECC71' },
  { initials: 'TY', color: '#E74C3C' },
];

const CaseStudiesPage = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const navigate = useNavigate();

  const handleCreateNewCase = () => {
    navigate('/scenario');
  };

  const filteredCaseStudies = caseStudiesData.filter((cs) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Completed') return cs.status === 'Completed';
    if (activeTab === 'In-Progress') return cs.status === 'In-Progress';
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
    }
  };

  return (
    <div className="case-studies-container">
      <SharedSidebar />
      <div className="main-content">
        <SharedHeader />
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
                {['All', 'Completed', 'In-Progress'].map((tab) => (
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
              {collaboratorsData.map((collaborator, index) => (
                <div key={index} className="collaborator-item">
                  <div className="collaborator-avatar" style={{ backgroundColor: collaborator.color }}>
                    {collaborator.initials}
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