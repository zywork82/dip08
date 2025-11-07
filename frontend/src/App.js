import React, { useState, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';

// --- Components ---

// --- Other page components (assuming paths) ---
import LoginPage from './pages/LoginPage';
import ScenarioFlowEditor from './pages/ScenarioFlowEditor';
import ScenarioPrompt from './pages/ScenarioPrompt';
import AdminDashboard from './pages/AdminDashboard';
import StudentPage from './pages/StudentPage';
import SignupPage from './pages/SignupPage';

import ScenarioInterface from './pages/ScenarioInterface.jsx';
import ReportInterface from './pages/ReportInterface.jsx';

// --- Data ---
// Renamed 'sampleNodes' to 'nodes' for clarity and to match your data file
import { sampleNodes as nodes } from './data/sampleAiFlow';

// This component holds the main app logic to work with the router
const AppContent = () => {
  const navigate = useNavigate();

  // --- State Hooks (at the top) ---
  const [analyticsData, setAnalyticsData] = useState([]);
  
  // Use a nullish check for startScenario in case '101' doesn't exist
  const startScenario = nodes['101'] || {}; 
  const [currentScenarioId, setCurrentScenarioId] = useState(startScenario.id || '101');

  // --- Derived State and Safety Checks ---
  const currentScenario = nodes[currentScenarioId];

  // Safety check to prevent crashes if an ID is invalid
  if (!currentScenario) {
    return (
      <div style={{ padding: '2rem', color: 'red', textAlign: 'center' }}>
        <h1>Error: Scenario Not Found</h1>
        <p>Could not find a scenario with the ID: <strong>'{currentScenarioId}'</strong>.</p>
        <p>Please check the 'next' value of the last option you clicked in your data file.</p>
      </div>
    );
  }
  
  // Check if the current scenario is the end of the playthrough
  const isFinished = !currentScenario.options || currentScenario.options.length === 0;

  // --- Handler Functions ---
  const handleOptionSelect = (selectedOption, timeTaken) => {
    
    // *** THIS IS THE KEY UPDATE ***
    // We now read 'selectedOption.data' directly, assuming it's a string
    // as per your new data structure.
    const newAnalyticEntry = {
      scenarioId: currentScenarioId,
      choice: selectedOption.data, // Changed from selectedOption.data.label
      timeTaken: parseFloat(timeTaken.toFixed(2)),
      scores: selectedOption.scores || {} // Get the scores, or an empty object if undefined
    };

    setAnalyticsData(prevData => [...prevData, newAnalyticEntry]);

    // Navigate to the next scenario
    if (selectedOption.next && nodes[selectedOption.next]) {
      setCurrentScenarioId(selectedOption.next);
    } else if (!selectedOption.next && !isFinished) {
      // Handle cases where 'next' is missing but it's not an end state
      console.error(`Option ${selectedOption.id} is missing a 'next' property.`);
    }
    // If it's finished, we just stay on the current ID, and 'isFinished' will become true
  };
  
  const handleRestart = () => {
    setAnalyticsData([]);
    setCurrentScenarioId(startScenario.id || '101');
    navigate('/scenarioInterface'); // Navigate back to the start
  };

  // This function is passed to ScenarioInterface to be called by the button
  const goToReport = () => {
    navigate('/report');
  };

  return (
    <Routes>
      {/* Your other routes */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/editor" element={<ScenarioFlowEditor />} />
      <Route path="/scenario" element={<ScenarioPrompt />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/student" element={<StudentPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* This route now handles the entire playthrough */}
      <Route 
        path="/scenarioInterface" 
        element={
          <ScenarioInterface
            scenario={currentScenario}
            onOptionSelect={handleOptionSelect}
            isFinished={isFinished}
            onGoToReport={goToReport} // Pass the navigation function
          />
        }
      />
      
      {/* This route is for the final report */}
      <Route 
        path="/report" 
        element={<ReportInterface data={analyticsData} onRestart={handleRestart} />}
      />
    </Routes>
  );
};

// --- Main App Component (with Navigation) ---
function App() {
  // Your navigation drag logic
  const navRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const handleMouseDown = (e) => {
    // This is placeholder logic for your drag functionality
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (moveE) => {
      setPosition({
        x: moveE.clientX - startX,
        y: moveE.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <HashRouter>
      <nav ref={navRef} className="test-nav-bar" onMouseDown={handleMouseDown} style={{ left: position.x, top: position.y, position: 'absolute', zIndex: 1000 }}>
        <div className="nav-handle">Drag to move</div>
        <ul>
            <li><Link to="/">Login</Link></li>
            <li><Link to="/editor">Editor</Link></li>
            <li><Link to="/scenario">Scenario</Link></li>
            <li><Link to="/admin">Admin Dashboard</Link></li>
            <li><Link to="/student">Student Page</Link></li>
            <li><Link to="/scenarioInterface">Scenario Interface</Link></li>
            <li><Link to="/signup">Signup</Link></li>
        </ul>
      </nav>

      <div className="main-content-wrapper">
        <AppContent />
      </div>
    </HashRouter>
  );
}

export default App;

