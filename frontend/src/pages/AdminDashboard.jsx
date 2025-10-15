import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import CaseStudyCard from '../components/CaseStudyCard';
import StudentRecordCard from '../components/StudentRecordCard';
import '../styles/Global.css';
import '../styles/Admin.css';
import { caseStudies } from '../data/mockdata.js';
import { MdHome, MdPeople, MdAssignment, MdLibraryBooks, MdSettings, MdLogout, MdFilterList, MdMoreVert } from 'react-icons/md';
import { FaPlusCircle } from 'react-icons/fa';
import axios from 'axios';

const profileImage = 'https://placehold.co/100x100/E6E6FA/3f51b5?text=${user.name[0]}';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [statsTab, setStatsTab] = useState('Projects');
  const [timeRange, setTimeRange] = useState('This year');
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
  const username = localStorage.getItem("adminUsername");
  const profileImg = localStorage.getItem("adminProfileImage") || profileImage;

  if (username) {
    setCurrentAdmin({
      username,
      profileImage: profileImg,
    });
  }
}, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const userRes = await axios.get('http://localhost:8000/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(userRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const handleCreateScenarioClick = () => navigate('/scenario');

  const adminNavItems = [
    { name: 'Dashboard', path: '#', icon: <MdHome className="text-xl" /> },
    { name: 'Case Studies', path: '#', icon: <MdAssignment className="text-xl" /> },
    { name: 'Students Records', path: '#', icon: <MdPeople className="text-xl" /> },
    { name: 'Tutorial', path: '#', icon: <MdLibraryBooks className="text-xl" /> },
    { name: 'Settings', path: '#', icon: <MdSettings className="text-xl" /> },
    { name: 'Logout', path: '#', icon: <MdLogout className="text-xl" /> },
  ];

  const trainingStats = [
    { country: 'United States', percentage: 52.1, color: '#3f51b5' },
    { country: 'Canada', percentage: 22.8, color: '#4caf50' },
    { country: 'Mexico', percentage: 15.9, color: '#ff9800' },
    { country: 'Other', percentage: 11.2, color: '#f44336' },
  ];
  
  const [currentAdmin, setCurrentAdmin] = useState({
  username: "Prof Andy",
  profileImage: profileImage, // your placeholder
  role: "Admin"});

  return (
    <div className="admin-page-container">
      <SharedSidebar navItems={adminNavItems} />
      <div className="main-content">
        <div className="header">
          <SharedHeader
            profileImage={currentAdmin.profileImage}
            userName={currentAdmin.username}
            userRole="Administrator"
        />

        </div>

        <div className="main-content-body">
          <section className="left-column">
            {/* Recent Activities */}
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

            {/* Individual Statistics */}
            <div className="individual-statistics-section">
              <div className="section-header">
                <h2>Individual Statistics</h2>
              </div>

              {/* Hardcoded table */}
              <div className="analytics-summary">
                <h3 style={{ marginBottom: '10px' }}>Average Time Taken per Option (seconds)</h3>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}>
                  <thead style={{ backgroundColor: '#f5f5f5' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Question ID</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Option A</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Option B</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Option C</th>
                      <th style={{ textAlign: 'left', padding: '10px' }}>Option D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { questionId: 'Q1', A: 5.3, B: 7.1, C: 6.8, D: 8.2 },
                      { questionId: 'Q2', A: 4.7, B: 5.9, C: 6.1, D: 7.3 },
                      { questionId: 'Q3', A: 6.0, B: 7.4, C: 6.9, D: 5.8 },
                      { questionId: 'Q4', A: 8.1, B: 6.2, C: 7.0, D: 9.4 },
                    ].map((row, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px', fontWeight: '500' }}>{row.questionId}</td>
                        <td style={{ padding: '10px' }}>{row.A}</td>
                        <td style={{ padding: '10px' }}>{row.B}</td>
                        <td style={{ padding: '10px' }}>{row.C}</td>
                        <td style={{ padding: '10px' }}>{row.D}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bar Chart */}
              <div style={{
                marginTop: '30px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                padding: '20px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ marginBottom: '15px' }}>Average Response Time (Visual)</h3>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  height: '200px'
                }}>
                  {[
                    { label: 'Option A', value: 6 },
                    { label: 'Option B', value: 7.5 },
                    { label: 'Option C', value: 6.4 },
                    { label: 'Option D', value: 8.1 },
                  ].map((item, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '40px',
                        height: `${item.value * 15}px`,
                        backgroundColor: '#3f51b5',
                        borderRadius: '6px 6px 0 0',
                        marginBottom: '8px',
                        transition: 'height 0.3s ease'
                      }}></div>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{item.label}</span>
                      <div style={{ fontSize: '12px', color: '#555' }}>{item.value}s</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Right Column */}
          <aside className="right-column">
            {/* Training Statistics */}
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
                    <div className="stat-info" style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: stat.color,
                        marginRight: '12px'
                      }}></div>
                      <span style={{ fontWeight: '500' }}>{stat.country}</span>
                    </div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{stat.percentage}%</div>
                  </div>
                ))}
              </div>

              {/* Pie Chart */}
              <div style={{
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
                }}>Total</div>
              </div>
            </div>

            {/* Students Records */}
            <section className="students-records-section">
            <div className="section-header">
              <h3>Recent Trainees' Records</h3>
              <div className="search-students">
                <input
                  type="text"
                  placeholder="Search by name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <i className="icon-search"></i>
              </div>
            </div>
            <div className="student-list">
              {users
                .filter((user) =>
                  user.username?.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((user) => (
                  <StudentRecordCard
                    key={user._id}
                    student={{
                      id: user._id,
                      name: user.username,
                      email: user.email,
                      role: user.role,
                    }}
                  />
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
