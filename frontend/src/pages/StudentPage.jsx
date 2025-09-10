import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Global.css';
import '../styles/Student.css';
import { caseStudies } from '../data/mockdata.js';
import CaseStudyCard from '../components/CaseStudyCard';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import TutorialBanner from '../components/TutorialBanner';
const profileImage = 'https://placehold.co/40x40/E6E6FA/3f51b5?text=HW';
const tips = [
  {
    id: 1,
    title: 'Seeing the Big Picture: Why Strategic Thinking Starts with Vision',
    image: 'https://placehold.co/100x100/E0E0E0/333?text=Tip+1',
  },
  {
    id: 2,
    title: 'From Problems to Patterns: Thinking in Systems',
    image: 'https://placehold.co/100x100/E0E0E0/333?text=Tip+2',
  },
  {
    id: 3,
    title: 'Decision-Making Under Uncertainty: Using Mental Models',
    image: 'https://placehold.co/100x100/E0E0E0/333?text=Tip+3',
  },
];



const TipCard = ({ title, image }) => (
  <div className="tip-card">
    <div className="tip-image-container">
      <img src={image} alt="Tip" onError={(e) => e.target.src = 'https://placehold.co/100x100/E0E0E0/333?text=Image+Not+Found'} />
    </div>
    <div className="tip-info">
      <p className="tip-title">{title}</p>
      <a href="#" className="tip-link">Read More {'>'}</a>
    </div>
  </div>
);

const StudentPage = () => {
  const [activeTab, setActiveTab] = useState('All');

 const filteredScenarios = caseStudies.filter(s => {
    if (activeTab === 'All') return true;
    return s.status === activeTab;
  });

  return (
    <div className="student-page-container">
      <SharedSidebar />
      
      <main className="main-content">
        <section className="main-section">
          <div className="header">
            <SharedHeader profileImage={profileImage} userName="Helen Wong" userRole="Student" />
          </div>
          <div className="main-content-body">
            <div className="left-column">
          <TutorialBanner />
 <div className="case-studies-section">
              <div className="section-header">
                <h2>Case Studies</h2>
              
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
            </div>
            <div className="right-column"><aside className="tips-aside">
          <h3 className="tips-heading">Tips On Strategic Thinking</h3>
          <div className="tips-list">
            {tips.map(tip => (
              <TipCard key={tip.id} {...tip} />
            ))}
          </div>
        </aside>
        </div>
            </div>
            
            

          </section>


        
        
      </main>
    </div>
  );
};

export default StudentPage;
