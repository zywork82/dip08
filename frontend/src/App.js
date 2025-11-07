// App.jsx
import React, { useState, useRef, useEffect } from "react";
import { HashRouter, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import FlowChartEditor from "./pages/FlowChartEditor";
import SceneEditor from "./pages/SceneEditor";
import ScenarioPrompt from "./pages/ScenarioPrompt";
import StudentPage from "./pages/StudentPage";
import AdminDashboard from "./pages/AdminDashboard";
import CaseStudiesPage from "./pages/CaseStudiesPage";
import TraineeRecords from "./pages/TraineeRecordsPage";
import Settings from "./pages/SettingsPage";
import SignupPage from "./pages/SignupPage";
import ScenarioInterface from "./pages/ScenarioInterface";
import ReportInterface from "./pages/ReportInterface";
import TrainerTeam from "./pages/TrainerTeam";
import StudentCaseStudies from "./pages/StudentCaseStudies";
import StudentRecords from "./pages/StudentRecords";
import StudentSettings from "./pages/StudentSetting";
import SimulationInterface from "./pages/SimulationInterface";

import "./App.css";
import { sampleNodes as nodes } from "./data/sampleAiFlow";


// ==============================
// Main App Content
// ==============================
const AppContent = () => {
  const navigate = useNavigate();
  const [analyticsData, setAnalyticsData] = useState([]);

  const startScenario = nodes["101"] || {};
  const [currentScenarioId, setCurrentScenarioId] = useState(startScenario.id || "101");
  const currentScenario = nodes[currentScenarioId];

  // ✅ move all hooks to the top (safe)
  useEffect(() => {
    const suppressResizeObserverError = (error) => {
      if (error.message?.includes("ResizeObserver loop completed")) return;
      console.error(error);
    };
    window.addEventListener("error", suppressResizeObserverError);
    return () => window.removeEventListener("error", suppressResizeObserverError);
  }, []);

  const handleOptionSelect = (selectedOption, timeTaken) => {
    const newAnalyticEntry = {
      scenarioId: currentScenarioId,
      choice: selectedOption.data,
      timeTaken: parseFloat(timeTaken.toFixed(2)),
      scores: selectedOption.scores || {},
    };
    setAnalyticsData((prev) => [...prev, newAnalyticEntry]);

    if (selectedOption.next && nodes[selectedOption.next]) {
      setCurrentScenarioId(selectedOption.next);
    } else {
      console.error(`Option ${selectedOption.id} is missing 'next'`);
    }
  };

  const handleRestart = () => {
    setAnalyticsData([]);
    setCurrentScenarioId(startScenario.id || "101");
    navigate("/scenarioInterface");
  };

  const goToReport = () => navigate("/report");

  const isFinished =
    !currentScenario?.options || currentScenario.options.length === 0;

  // ✅ instead of returning early, render conditionally inside JSX
  if (!currentScenario) {
    return (
      <div style={{ padding: "2rem", color: "red", textAlign: "center" }}>
        <h1>Error: Scenario Not Found</h1>
        <p>
          Could not find scenario ID: <strong>{currentScenarioId}</strong>
        </p>
      </div>
    );
  }

  return (
    <Routes>
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
      <Route path="/student-case-studies" element={<StudentCaseStudies />} />
      <Route path="/my-records" element={<StudentRecords />} />
      <Route path="/student-settings" element={<StudentSettings />} />
      <Route path="/simulation" element={<SimulationInterface />} />
      <Route path="/flowchart" element={<Navigate to="/editor" replace />} />

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



// ==============================
// Root App (with draggable nav)
// ==============================
function App() {
  const navRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
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

  // --- Backend health check ---
  useEffect(() => {
    fetch("http://127.0.0.1:5000/health")
      .then((res) => {
        if (res.ok) console.log("✅ Backend connected successfully!");
        else console.warn("⚠️ Backend responded but not OK:", res.status);
      })
      .catch(() => console.error("❌ Backend not reachable."));
  }, []);

  return (
    <HashRouter>
      <nav
        ref={navRef}
        className="test-nav-bar"
        onMouseDown={handleMouseDown}
        style={{
          left: position.x,
          top: position.y,
          position: "absolute",
          zIndex: 1000,
        }}
      >
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
