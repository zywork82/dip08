import React, { useState, useEffect} from 'react';
import { Link } from 'react-router-dom';
import '../styles/Global.css';
import '../styles/Student.css';
import { caseStudies } from '../data/mockdata.js';
import CaseStudyCard from '../components/CaseStudyCard';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import TutorialBanner from '../components/TutorialBanner';
import axios from 'axios';
import StudentSidebar from '../components/StudentSidebar.jsx';
import StudentCaseStudyCard from '../components/StudentCasestudycard.jsx';

const profileImage = 'https://placehold.co/40x40/E6E6FA/3f51b5?text=HW';
const tips = [
  {
    id: 1,
    title: 'Seeing the Big Picture: Why Strategic Thinking Starts with Vision',
    image: 'https://static.vecteezy.com/system/resources/previews/008/453/019/non_2x/strategic-thinking-to-get-business-solution-and-win-competition-leadership-challenge-to-think-about-new-idea-intelligence-or-wisdom-for-success-businessman-thinking-with-chess-piece-on-his-head-vector.jpg',
  },
  {
    id: 2,
    title: 'From Problems to Patterns: Thinking in Systems',
    image: 'https://www.designorate.com/wp-content/uploads/2017/07/systems_Thinking-1.jpg',
  },
  {
    id: 3,
    title: 'Decision-Making Under Uncertainty: Using Mental Models',
    image: 'https://blog.tmetric.com/content/images/2022/11/10_Mental_Models_1160x664_2.png',
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
  const [student, setStudent] = useState(null);
   const [caseStudies, setCaseStudies] = useState([]);
  const [loadingCaseStudies, setLoadingCaseStudies] = useState(false);
  const [caseStudiesError, setCaseStudiesError] = useState(null);



  // useEffect(() => {
  //   // Example: load student from localStorage after login
  //   const storedUser = JSON.parse(localStorage.getItem('user'));
  //   if (storedUser) setStudent(storedUser);
  // }, []);

 const filteredScenarios = caseStudies.filter(s => {
    if (activeTab === 'All') return true;
    return s.status === activeTab;
  });

  useEffect(() => {
  const fetchCaseStudies = async () => {
    setLoadingCaseStudies(true);
    setCaseStudiesError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("No token found in localStorage");

      const res = await axios.get('http://localhost:5000/scenarios/', {

      });

      console.log("Raw response data:", res.data);

      // Handle case if API wraps scenarios in an object
      let scenariosArray = [];
      if (Array.isArray(res.data)) {
        scenariosArray = res.data;
      } else if (res.data?.scenarios && Array.isArray(res.data.scenarios)) {
        scenariosArray = res.data.scenarios;
      } else {
        throw new Error("Unexpected response format");
      }

      console.log("Processed scenarios array:", scenariosArray);
      setCaseStudies(scenariosArray);

    } catch (err) {
      console.error("Error fetching scenarios:", err);
      setCaseStudiesError(err.message);
      setCaseStudies([]); // ensure state is empty on error
    } finally {
      setLoadingCaseStudies(false);
    }
  };

  fetchCaseStudies();
}, []);




  return (
    <div className="student-page-container">
      <StudentSidebar />
      
      <main className="main-content">
        <section className="main-section">
          <div className="header">
            <SharedHeader 
              profileImage={profileImage} 
              userName={student?.username || "Guest"} 
              userRole="Student" 
            />
          </div>
          <div className="main-content-body">
            <div className="left-column">
          {/* <TutorialBanner /> */}
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
              {loadingCaseStudies && <p>Loading scenarios...</p>}
              {caseStudiesError && <p>Error: {caseStudiesError}</p>}
              {!loadingCaseStudies && !caseStudiesError && filteredScenarios.map(scenario => (
                <div key={scenario._id} className="activity-item-card">
                  <StudentCaseStudyCard
                    title={scenario.title}
                    lastEdited={scenario.lastEdited}
                    status={scenario.status}
                    image={scenario.image}
                    scenarioId={scenario._id || scenario.id} // fallback
                  />
                </div>
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
