import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import CaseStudyCard from '../components/CaseStudyCard';
import StudentRecordCard from '../components/StudentRecordCard';
import TutorialBanner from '../components/TutorialBanner';
import '../styles/Global.css';
import '../styles/Admin.css';
import { caseStudies, students } from '../data/mockdata.js';
import { MdHome, MdPeople, MdAssignment, MdLibraryBooks, MdSettings, MdLogout } from 'react-icons/md';

// Placeholder for the profile image
const profileImage = 'https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A';
const scenarioPlaceholder1 = 'https://placehold.co/300x200/F0F2F5/888?text=Placeholder+Image';
const scenarioPlaceholder2 = 'https://placehold.co/300x200/F0F2F5/888?text=Placeholder+Image';

const AdminDashboard = () => {
//   // Mock data for scenarios and student records
//   const [scenarios, setScenarios] = useState([
//     { id: 1, title: 'Viral Post Handling', lastEdited: '27/8/2025', image: scenarioPlaceholder1, status: 'In-Progress' },
//     { id: 2, title: 'Missing Funds', lastEdited: '27/8/2025', image: scenarioPlaceholder2, status: 'Completed' },
//     { id: 3, title: 'Project Failure Analysis', lastEdited: '26/8/2025', image: scenarioPlaceholder1, status: 'Completed' },
//   ]);


  const [activeTab, setActiveTab] = useState('All');

  const filteredScenarios = caseStudies.filter(s => {
    if (activeTab === 'All') return true;
    return s.status === activeTab;
  });

  const adminNavItems = [
    { name: 'Home', path: '#', icon: <MdHome className="text-xl" /> },
    { name: 'Case Studies', path: '#', icon: <MdAssignment className="text-xl" /> },
    { name: 'Students Records', path: '#', icon: <MdPeople className="text-xl" /> },
    { name: 'Tutorial', path: '#', icon: <MdLibraryBooks className="text-xl" /> },
    { name: 'Settings', path: '#', icon: <MdSettings className="text-xl" /> },
    { name: 'Logout', path: '#', icon: <MdLogout className="text-xl" /> },
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
           <TutorialBanner />
             <div className="case-studies-section">
              <div className="section-header">
                <h2>Case Studies</h2>
                <Link to="/scenario" className="btn-create">Create Scenario</Link>
              </div>
              <div className="scenario-tabs">
                {['All', 'Completed', 'In-Progress'].map(tab => (
                  <span
                    key={tab}
                    className={`tab ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </span>
                ))}
                <div className="view-toggle">
                  <i className="icon-list-view"></i>
                  <i className="icon-grid-view active"></i>
                </div>
              </div>
              <div className="scenario-grid">
                {filteredScenarios.map(scenario => (
                  <CaseStudyCard key={scenario.id} {...scenario} />
                ))}
              </div>
            </div>
          </section>

          <aside className="right-column">
            <section className="students-records-section">
              <div className="section-header">
                <h3>Recent Students' Records</h3>
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
