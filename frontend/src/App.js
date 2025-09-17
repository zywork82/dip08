// App.jsx
import React, { useState, useRef, useEffect } from "react";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import ScenarioFlowEditor from "./pages/ScenarioFlowEditor";
import ScenarioPrompt from "./pages/ScenarioPrompt";
import StudentPage from "./pages/StudentPage";
import AdminDashboard from "./pages/AdminDashboard";
import SignupPage from "./pages/SignupPage";
import PreviewPage from "./pages/PreviewPage";
import TraineeRecordsPage from "./pages/TraineeRecordsPage";
import SettingsPage from "./pages/SettingsPage";
import AnalyticsEngine from "./pages/AnalyticsEngine";
import "./App.css";
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
          <li><Link to="/editor">Editor</Link></li>
          <li><Link to="/scenario">Scenario</Link></li>
          <li><Link to="/admin">Admin Dashboard</Link></li>
          <li><Link to="/student">Student Page</Link></li>
          <li><Link to="/signup">Signup</Link></li>
          <li><Link to="/analytics">Analytics</Link></li>
        </ul>
      </nav>

      {/* Main content */}
      <main className="main-content-wrapper">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/editor" element={<ScenarioFlowEditor />} />
          <Route path="/scenario" element={<ScenarioPrompt />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/student" element={<StudentPage />} />
          <Route path="/signup" element={<SignupPage />} />
           <Route path="/preview" element={<PreviewPage />} />
           <Route path="/trainee-records" element={<TraineeRecordsPage />} />
           <Route path="/settings" element={<SettingsPage />} />
            <Route path="/analytics" element={<AnalyticsEngine />} />
        </Routes>
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
