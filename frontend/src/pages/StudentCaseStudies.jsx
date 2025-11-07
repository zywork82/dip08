import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedHeader from '../components/SharedHeader';
import StudentSidebar from '../components/StudentSidebar';
import { FaTh, FaBars } from 'react-icons/fa';
import '../styles/CaseStudiesPage.css'; // Import the new CSS file
import StudentCasestudycard from '../components/StudentCasestudycard.jsx';

const getInitials = (name) => {
  if (!name) return 'A';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase(); // e.g. "Prof Andy" → "PA"
};

const StudentCaseStudies = () => {
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
      const response = await fetch("http://localhost:5000/scenarios");
      const data = await response.json();
      setCaseStudiesData(data);
    } catch (error) {
      console.error("Error fetching case studies:", error);
    }
  };
  fetchCaseStudies();
}, []);

  const filteredCaseStudies = caseStudiesData.filter((cs) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Published') return cs.status === 'Published';
    if (activeTab === 'In-Progress') return cs.status === 'In-Progress' || cs.status === 'Edit';
    return false;
  });

   const renderCaseStudies = () => {
  // Step 1: filter based on tab
  const filteredCaseStudies = caseStudiesData.filter((cs) => {
    if (activeTab === 'All') {
      return cs.status === 'Published' || cs.status === 'Completed';
    }
    if (activeTab === 'Completed') {
      return cs.status === 'Completed';
    }
    if (activeTab === 'To Complete') {
      return cs.status === 'Published'; // show published but not yet completed
    }
    return false;
  });

  // Step 2: handle empty results
  if (filteredCaseStudies.length === 0) {
    return <p className="no-case-studies">No case studies available.</p>;
  }

  // Step 3: render cards
  return (
    <div className={viewMode === 'grid' ? 'cards-grid' : 'cards-list'}>
      {filteredCaseStudies.map((cs) => (
        <StudentCasestudycard
          key={cs.id}
          title={cs.title}
          lastEdited={cs.lastEdited}
          status={cs.status}
          image={cs.image}
        />
      ))}
    </div>
  );
};

  return (
    <div className="case-studies-container">
      <StudentSidebar />
      <div className="main-content">
        <SharedHeader profileImage={profileImage} userName={userName} userEmail={userEmail} />
        <div className="page-body">
          <div className="case-studies-section">
            <div className="banner">
              <div style={{ lineHeight: 1.5 }}>
                <span style={{ fontSize: '1rem', fontWeight: 400 }}>New to Deciwise?</span>
                <br />
                <a href="/tutorial" className="banner-link">
                  <span className="banner-text">Begin your Tutorial</span>
                </a>
              </div>
            </div>

            <div className="header-row">
              <h2 className="page-title">Case Studies</h2>
            </div>

            <div className="tab-container">
              <div className="tabs">
                {['All', 'Completed', 'To Complete'].map((tab) => (
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
                  <div
                    className="collaborator-avatar"
                    style={{ backgroundColor: admin.color || '#5a466dff' }}
                  >
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
export default StudentCaseStudies;