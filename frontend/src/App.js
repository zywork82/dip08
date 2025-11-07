// App.jsx
import React, { useState, useRef, useEffect } from "react";
import { HashRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import FlowChartEditor from "./pages/FlowChartEditor";
import SceneEditor from "./pages/SceneEditor.jsx";
import ScenarioPrompt from "./pages/ScenarioPrompt";
import StudentPage from "./pages/StudentPage";
import AdminDashboard from "./pages/AdminDashboard";
import CaseStudiesPage from "./pages/CaseStudiesPage";
import TraineeRecords from "./pages/TraineeRecordsPage";
import Settings from "./pages/SettingsPage";
import SignupPage from "./pages/SignupPage";
import "./App.css";
import ScenarioInterface from "./pages/ScenarioInterface";
import ReportInterface from './pages/ReportInterface.jsx';
import {sampleNodes} from '../src/data/sampleAiFlow.js';
import TrainerTeam from "./pages/TrainerTeam.jsx";
import StudentCaseStudies from "./pages/StudentCaseStudies.jsx";
import StudentRecords from "./pages/StudentRecords.jsx";
import StudentSettings from "./pages/StudentSetting.jsx";
import SimulationInterface from "./pages/SimulationInterface";
import { Navigate } from "react-router-dom";

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
const suppressResizeObserverError = (error) => {
  // Check if the error message contains the specific text
  if (error.message && error.message.includes('ResizeObserver loop completed with undelivered notifications')) {
    // Return immediately, preventing the error from being logged
    return;
  }
  // For all other errors, log them as normal
  console.error(error);
};

// Apply the suppression function globally in the browser's window context
// This will only work in development (non-production) environments.
window.addEventListener('error', suppressResizeObserverError);
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
      <Route path="/case-studies" element={<CaseStudiesPage />} />
      <Route path="/trainer-team" element={<TrainerTeam />} />
      <Route path="/trainee-records" element={<TraineeRecords />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/editor" element={<FlowChartEditor />} />
      <Route path="/scenario" element={<ScenarioPrompt />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/student" element={<StudentPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/scene-editor" element={<SceneEditor />} />
      <Route path="/report" element={<ReportInterface />} />
      <Route path="/flowchart" element={<Navigate to="/editor" replace />} />
      <Route path="/student-case-studies" element={<StudentCaseStudies />} />
      <Route path="/my-records" element={<StudentRecords />} />
      <Route path="/student-settings" element={<StudentSettings />} />
      <Route path="/simulation" element={<SimulationInterface />} />  
      {/* --- Updated Scenario and Report Routes --- */}
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
  }, [isDragging, offset]);
 useEffect(() => {
  fetch("http://127.0.0.1:5000/health")
    .then((res) => {
      if (res.ok) console.log("✅ Backend connected successfully!");
      else console.warn("⚠️ Backend responded, but not OK:", res.status);
    })
    .catch(() => console.error("❌ Backend not reachable."));
}, []);



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
            <li><Link to="/scene-editor">SceneEditor</Link></li>
            <li><Link to="/admin">Admin Dashboard</Link></li>
            <li><Link to="/student">Student Page</Link></li>
            <li><Link to="/scenarioInterface">Scenario Interface</Link></li>
            <li><Link to="/simulation">Simulation</Link></li>
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

