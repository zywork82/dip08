// src/ScenarioInterface.jsx

import React, { useState, useEffect } from 'react';
import '../styles/Global.css'; // Make sure paths are correct
import '../styles/ScenarioInterface.css';
import OptionNode from '../components/OptionNode.jsx';
import { sampleNodes} from '../data/sampleAiFlow.js'; // We need this for the lookups


const ScenarioInterface = ({ scenario, onOptionSelect, isFinished, onGoToReport }) => {
  // 2. Your existing timer logic is correct
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    setStartTime(Date.now());
  }, [scenario.id]);

  if (!scenario) {
    return <div>Loading scenario...</div>;
  }

  return (
    <div className="scenario-container">
      {/* This is your existing JSX structure */}
      <div className="main-section">
        {/* You can add images or other content here later */}
      </div>

      <section className="promptBox">
        {/* Made this more robust to handle different data shapes */}
        <p>{scenario.data.label || scenario.data}</p>

        <div className="optionsWrapper">
          {/* --- 3. UPDATED LOGIC --- */}
          {/* If the playthrough is finished, show the report button */}
          {isFinished ? (
            <div className="report-navigation">
              <p>You have reached the end of the playthrough.</p>
              <button onClick={onGoToReport} className="restart-button">
                View Your Report
              </button>
            </div>
          ) : (
            /* Otherwise, show the available options using your existing map logic */
            scenario.options.map(optionId => {
              const optionData = sampleNodes[optionId];
              if (!optionData) return null;

              const handleSelect = () => {
                const timeTaken = (Date.now() - startTime) / 1000;
                onOptionSelect(optionData, timeTaken);
              };

              return (
                <OptionNode
                  key={optionData.id}
                  option={optionData.data}
                  onClick={handleSelect}
                />
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default ScenarioInterface;