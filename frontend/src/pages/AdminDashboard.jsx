import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import CaseStudyCard from '../components/CaseStudyCard';
import StudentRecordCard from '../components/StudentRecordCard';
import '../styles/Global.css';
import '../styles/Admin.css';
import { caseStudies, students } from '../data/mockdata.js';
import { MdHome, MdPeople, MdAssignment, MdLibraryBooks, MdSettings, MdLogout, MdLaptop, MdFilterList, MdMoreVert } from 'react-icons/md';
import { FaPlusCircle } from 'react-icons/fa';

// Placeholder for the profile image
const profileImage = 'https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [statsTab, setStatsTab] = useState('Projects');
  const [timeRange, setTimeRange] = useState('This year');
  const navigate = useNavigate();

  const filteredScenarios = caseStudies.filter(s => {
    if (activeTab === 'All') return true;
    return s.status === activeTab;
  });

  const handleCreateScenarioClick = () => {
    navigate('/scenario');
  };

  const adminNavItems = [
    { name: 'Dashboard', path: '#', icon: <MdHome className="text-xl" /> },
    { name: 'Case Studies', path: '#', icon: <MdAssignment className="text-xl" /> },
    { name: 'Students Records', path: '#', icon: <MdPeople className="text-xl" /> },
    { name: 'Tutorial', path: '#', icon: <MdLibraryBooks className="text-xl" /> },
    { name: 'Settings', path: '#', icon: <MdSettings className="text-xl" /> },
    { name: 'Logout', path: '#', icon: <MdLogout className="text-xl" /> },
  ];

  // Training statistics data
  const trainingStats = [
    { country: 'United States', percentage: 52.1, color: '#3f51b5' },
    { country: 'Canada', percentage: 22.8, color: '#4caf50' },
    { country: 'Mexico', percentage: 15.9, color: '#ff9800' },
    { country: 'Other', percentage: 11.2, color: '#f44336' }
  ];

  return (
    <div className="admin-page-container">
      <SharedSidebar navItems={adminNavItems} />
      <div className="main-content">
        <div className="header">
          <SharedHeader profileImage={profileImage} userName="Prof Andy" userRole="Administrator" />
        </div>
        <div className="main-content-body">
          <section className="left-column">
            {/* Recent Activities section */}
            <div className="recent-activities-section">
              <div className="section-header">
                <h2>Recent Activities</h2>
              </div>
              <div className="activity-container">
                <div className="scenario-scroll-wrapper">
                  {caseStudies.map(scenario => (
                    <div key={scenario.id} className="activity-item-card">
                      <CaseStudyCard {...scenario} />
                    </div>
                  ))}
                </div>
                <div className="activity-buttons">
                  <button className="activity-button create-scenario" onClick={handleCreateScenarioClick}>
                    <span>Create New Scenarios</span>
                    <FaPlusCircle className="activity-icon" />
                  </button>
                  <div className="activity-button view-all-scenarios">
                    <span>View All Scenarios</span>
                    <FaPlusCircle className="activity-icon" />
                  </div>
                  <div className="activity-button manage-collaborators">
                    <span>Manage Collaborators</span>
                    <FaPlusCircle className="activity-icon" />
                  </div>
                  <div className="activity-button manage-team">
                    <span>Manage Team</span>
                    <FaPlusCircle className="activity-icon" />
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Statistics section (replacing Case Studies) */}
            <div className="individual-statistics-section">
              <div className="section-header">
                <h2>Individual Statistics</h2>
              </div>
              
              {/* Stats tabs and filters */}
              <div className="stats-tabs">
                {['Projects', 'Operating Status', 'Decision Steps Taken'].map(tab => (
                  <span
                    key={tab}
                    className={`stats-tab ${statsTab === tab ? 'active' : ''}`}
                    onClick={() => setStatsTab(tab)}
                  >
                    {tab}
                  </span>
                ))}
                
                <div className="toggle-group">
                  {['This year', 'Last year'].map(range => (
                    <span
                      key={range}
                      className={`toggle-option ${timeRange === range ? 'active' : ''}`}
                      onClick={() => setTimeRange(range)}
                    >
                      {range}
                    </span>
                  ))}
                </div>
                
                <div className="toggle-group-right">
                  <select className="select-dropdown">
                    <option>Week</option>
                    <option>Month</option>
                    <option>Quarter</option>
                    <option>Year</option>
                  </select>
                  <MdFilterList className="icon-filter" />
                  <MdMoreVert className="icon-more" />
                </div>
              </div>
              
              {/* Graph container */}
              <div className="stats-graph-container">
                <h3>User's</h3>
                <div className="graph-placeholder" style={{height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 20px'}}>
                  {['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'].map(month => (
                    <div key={month} style={{
                      width: '30px',
                      height: `${Math.random() * 70 + 30}px`,
                      backgroundColor: '#3f51b5',
                      borderRadius: '4px 4px 0 0'
                    }} title={month}></div>
                  ))}
                </div>
                <div style={{display: 'flex', justifyContent: 'space-around', padding: '10px 20px'}}>
                  {['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'].map(month => (
                    <span key={month} style={{fontSize: '12px'}}>{month}</span>
                  ))}
                </div>
              </div>
              
              {/* Second graph container */}
              <div className="stats-graph-container">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                  <h3>Users</h3>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <span style={{fontSize: '14px', padding: '4px 8px', backgroundColor: '#e0e0e0', borderRadius: '6px'}}>Projects</span>
                    <span style={{fontSize: '14px', padding: '4px 8px', backgroundColor: '#f0f0f0', borderRadius: '6px'}}>Operating Status</span>
                    <span style={{fontSize: '14px', padding: '4px 8px', backgroundColor: '#f0f0f0', borderRadius: '6px'}}>Week</span>
                  </div>
                </div>
                <div className="graph-placeholder" style={{height: '150px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 20px'}}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => (
                    <div key={month} style={{
                      width: '30px',
                      height: `${Math.random() * 50 + 20}px`,
                      backgroundColor: '#4caf50',
                      borderRadius: '4px 4px 0 0'
                    }} title={month}></div>
                  ))}
                </div>
                <div style={{display: 'flex', justifyContent: 'space-around', padding: '10px 20px'}}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => (
                    <span key={month} style={{fontSize: '12px'}}>{month}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="right-column">
            {/* New Training Statistics section */}
            <div className="training-statistics-section" style={{
              backgroundColor: 'var(--secondary-bg)',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: 'var(--shadow)',
              marginBottom: '24px'
            }}>
              <div className="section-header">
                <h3>Training Statistics</h3>
              </div>
              
              <div className="training-stats-container">
                {trainingStats.map((stat, index) => (
                  <div key={index} className="training-stat-item" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px'
                  }}>
                    <div className="stat-info" style={{display: 'flex', alignItems: 'center'}}>
                      <div className="color-indicator" style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: stat.color,
                        marginRight: '12px'
                      }}></div>
                      <span className="country-name" style={{fontWeight: '500'}}>{stat.country}</span>
                    </div>
                    <div className="stat-percentage" style={{
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}>
                      {stat.percentage}%
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Simple pie chart visualization */}
              <div className="pie-chart-container" style={{
                position: 'relative',
                width: '200px',
                height: '200px',
                margin: '20px auto',
                borderRadius: '50%',
                background: `conic-gradient(
                  ${trainingStats[0].color} 0% ${trainingStats[0].percentage}%, 
                  ${trainingStats[1].color} 0% ${trainingStats[0].percentage + trainingStats[1].percentage}%,
                  ${trainingStats[2].color} 0% ${trainingStats[0].percentage + trainingStats[1].percentage + trainingStats[2].percentage}%,
                  ${trainingStats[3].color} 0% 100%
                )`
              }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '100px',
                  height: '100px',
                  backgroundColor: 'var(--secondary-bg)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}>
                  Total
                </div>
              </div>
            </div>

            {/* Students Records section */}
            <section className="students-records-section">
              <div className="section-header">
                <h3>Recent Trainees' Records</h3>
                <div className="search-students">
                  <input type="text" placeholder="Search by name" />
                  <i className="icon-search"></i>
                </div>
              </div>
              <div className="student-list">
                {students.map(student => (
                  <StudentRecordCard key={student.id} student={student} />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;