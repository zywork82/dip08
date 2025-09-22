// App.jsx
import React, { useState, useRef, useEffect } from "react";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import FlowChartEditor from "./pages/FlowChartEditor";
import ScenarioPrompt from "./pages/ScenarioPrompt";
import StudentPage from "./pages/StudentPage";
import AdminDashboard from "./pages/AdminDashboard";
import SignupPage from "./pages/SignupPage";
import PreviewPage from "./pages/PreviewPage";
import TraineeRecordsPage from "./pages/TraineeRecordsPage";
import SettingsPage from "./pages/SettingsPage";
import SceneEditor from "./pages/SceneEditor";
import TrainerTeam from './pages/TrainerTeam';
import CaseStudiesPage from './pages/CaseStudiesPage';
import AnalyticsEngine from "./pages/AnalyticsEngine";
import "./App.css";
import ScenarioInterface from "./pages/ScenarioInterface";
import {sampleNodes} from '../src/data/sampleAiFlow.js';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


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

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const startScenario = sampleNodes[101];
  const [currentScenarioId, setCurrentScenarioId] = useState(startScenario.id);

  // Look up the full data for the current scenario
  const currentScenario = sampleNodes[currentScenarioId];

  // Create state to store all analytics data
  const [analyticsData, setAnalyticsData] = useState([]);

  //Update the handler to accept the `timeTaken` argument
  const handleOptionSelect = (selectedOption, timeTaken) => {
    //Create a new entry for our analytics log
    const newAnalyticEntry = {
      scenarioId: currentScenarioId,
      choice: selectedOption.data,
      timeTaken: timeTaken.toFixed(2) + 's', // Format to 2 decimal places
    };

    //Add the new entry to our analytics state
    const updatedAnalytics = [...analyticsData, newAnalyticEntry];
    setAnalyticsData(updatedAnalytics);
    console.log('Analytics Log:', updatedAnalytics); // Log to the console

    if (selectedOption.next) {
      setCurrentScenarioId(selectedOption.next);
    }
  };

  return (
    <HashRouter>
      {/* Draggable Nav Bar */}
      <nav
        ref={navRef}
        className="test-nav-bar"

      >
        <div className="nav-handle">Drag to move</div>
        <ul>
          <li><Link to="/">Login</Link></li>
          <li><Link to="/editor">FlowChartEditor</Link></li>
          <li><Link to="/scene-editor">SceneEditor</Link></li>
          <li><Link to="/scenario">Scenario</Link></li>
          <li><Link to="/admin">Admin Dashboard</Link></li>
          <li><Link to="/student">Student Page</Link></li>
          <li><Link to="/scenarioInterface">Scenario Interface</Link></li>
          <li><Link to="/signup">Signup</Link></li>
          <li><Link to="/analytics">Analytics</Link></li>
        </ul>
      </nav>

      {/* Main content */}
      <main className="main-content-wrapper">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/editor" element={<FlowChartEditor />} />
          <Route path="/scenario" element={<ScenarioPrompt />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/student" element={<StudentPage />} />
          
          <Route path="/scenarioInterface" element={<ScenarioInterface scenario={currentScenario} 
        onOptionSelect={handleOptionSelect} />}/>

          <Route path="/signup" element={<SignupPage />} />
           <Route path="/preview" element={<PreviewPage />} />
           <Route path="/trainee-records" element={<TraineeRecordsPage />} />
           <Route path="/settings" element={<SettingsPage />} />
            <Route path="/analytics" element={<AnalyticsEngine />} />
           <Route path="/scene-editor" element={<SceneEditor />} />
           <Route path="/trainer-team" element={<TrainerTeam />} />
           <Route path="/case-studies" element={<CaseStudiesPage />} />

        </Routes>

        <div>
      
    </div>
      </main>
        <ToastContainer 
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop={true}
        closeOnClick
        pauseOnHover={false}
        draggable={false}
        theme="colored"
      />
    </HashRouter>

    
  );
}

export default App;
