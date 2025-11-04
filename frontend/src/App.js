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


const AppContent = () => {
  //Navigation Hook 
  //useNavigate must be called within a component that is a descendant of <Router>
  const navigate = useNavigate();

  //Scenario Playthrough State
  const startScenario = sampleNodes['101'];
  const [currentScenarioId, setCurrentScenarioId] = useState(startScenario.id);
  const [analyticsData, setAnalyticsData] = useState([]);

  const currentScenario = sampleNodes[currentScenarioId];

  if (!currentScenario) {
    return <div>Error: Could not find scenario with ID '{currentScenarioId}'.</div>;
  }

  const isFinished = !currentScenario.options || currentScenario.options.length === 0;

  
  // --- Handler Functions ---
  const handleOptionSelect = (selectedOption, timeTaken) => {
    const newAnalyticEntry = {
      scenarioId: currentScenarioId,
      choice: selectedOption.data.label,
      timeTaken: parseFloat(timeTaken.toFixed(2)),
    };
    setAnalyticsData(prevData => [...prevData, newAnalyticEntry]);

    if (selectedOption.next) {
      setCurrentScenarioId(selectedOption.next);
    } else {
      // This is an end state. The UI will update via isFinished.
      setCurrentScenarioId(selectedOption.id);
    }
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
    setCurrentScenarioId(startScenario.id);
    navigate('/scenarioInterface'); // Navigate back to the start
  };

  // This function will be passed to the ScenarioInterface
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
      

      {/* --- Updated Scenario and Report Routes --- */}
      <Route 
        path="/scenarioInterface" 
        element={
          <ScenarioInterface
            scenario={currentScenario}
            onOptionSelect={handleOptionSelect}
            isFinished={isFinished}
            onGoToReport={goToReport}
          />
        }
      />
      <Route 
        path="/report" 
        element={<ReportInterface data={analyticsData} onRestart={handleRestart} />}
      />
    </Routes>
  );
};

function App() {
  const navRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Dragging logic for nav
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - offset.x,
          y: e.clientY - offset.y,
        });
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
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



  const handleMouseDown = (e) => {
    setIsDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };
  

  return (
    <HashRouter>
      {/* Draggable Nav Bar */}
      <nav ref={navRef} className="test-nav-bar" onMouseDown={handleMouseDown} style={{ left: position.x, top: position.y }}>
        <div className="nav-handle">Drag to move</div>
        <ul>
            {/* Your Links */}
            <li><Link to="/">Login</Link></li>
            <li><Link to="/editor">Editor</Link></li>
            <li><Link to="/scenario">Scenario</Link></li>
            <li><Link to="/scene-editor">SceneEditor</Link></li>
            <li><Link to="/admin">Admin Dashboard</Link></li>
            <li><Link to="/student">Student Page</Link></li>
            <li><Link to="/scenarioInterface">Scenario Interface</Link></li>
            <li><Link to="/signup">Signup</Link></li>
        </ul>
      </nav>

      {/* Main content */}
      <div className="main-content-wrapper">

        <AppContent />
      </div>
    </HashRouter>
    
  );
}

export default App;
