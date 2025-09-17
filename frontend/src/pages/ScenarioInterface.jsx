// src/ScenarioInterface.jsx

import React, { useState, useEffect } from 'react';
import '../styles/Global.css'; // Make sure paths are correct
import '../styles/ScenarioInterface.css';
import OptionNode from '../components/OptionNode.jsx';
import { sampleNodes} from '../data/sampleAiFlow.js'; // We need this for the lookups


const ScenarioInterface = ({ scenario, onOptionSelect }) => {

  // 2. Create state to hold the start time
  const [startTime, setStartTime] = useState(Date.now());

  // 3. Use useEffect to reset the timer when the scenario changes
  // This code runs every time the `scenario.id` prop changes.
  useEffect(() => {
    setStartTime(Date.now());
  }, [scenario.id]);

  if (!scenario) {
    return <div>Loading scenario...</div>;
  }

  return (
    <div className="scenario-container">
      <div class="main-section">

      </div>

      <section className="promptBox">
        <p>{scenario.data.label}</p>
        <div className="optionsWrapper">
          
          {scenario.options.map(optionId => {
            // Look up the full data for each option
            const optionData = sampleNodes[optionId];
            
            if (!optionData) return null;

            const handleSelect = () => {
              // 4. Calculate time taken when an option is selected
              const timeTaken = (Date.now() - startTime) / 1000; // in seconds
              // 5. Pass the time taken up to the parent component
              onOptionSelect(optionData, timeTaken);
            };

            return (
              <OptionNode class='optionNode'
                key={optionData.id}
                option={optionData}
                // ADDED: Pass the click handler to the OptionNode
                onClick={handleSelect}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ScenarioInterface;