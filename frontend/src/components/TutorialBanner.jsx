import React from 'react';
import '../styles/TutorialBanner.css';
import { Link } from 'react-router-dom';

const TutorialBanner = () => {
  return (
    <div className="tutorial-section">
  <p className="tutorial-text">New to Deciwise?</p>
  <h2 className="tutorial-heading">Begin your Tutorial</h2>
  <Link to="/tutorial" className="tutorial-link">Start Now {'>'}</Link> {/* ← here */}
</div>

  );
};

export default TutorialBanner;