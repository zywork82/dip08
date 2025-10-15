import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Global.css";
import "../styles/ScenarioInterface.css";
import OptionNode from "../components/OptionNode.jsx";
import { sampleNodes } from "../data/sampleAiFlow.js";

const ScenarioInterface = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ Get flow data (can be null)
  const flowDataFromState = location.state?.flowData;
  const flowDataFromStorage = JSON.parse(localStorage.getItem("latestFlow"));
  const flowData = flowDataFromState || flowDataFromStorage || null;

  // ✅ Hooks must be declared unconditionally
  const startNodeId = flowData?.startNodeId || flowData?.nodes?.[0]?.id || null;
  const [currentNodeId, setCurrentNodeId] = useState(startNodeId);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    setStartTime(Date.now());
  }, [currentNodeId]);

  if (!flowData) {
    return (
      <div>
        ⚠️ No scenario data found. Go back to{" "}
        <button onClick={() => navigate("/scene-editor")}>Editor</button>
      </div>
    );
  }

  const currentNode = flowData.nodes.find((n) => n.id === currentNodeId);
  if (!currentNode) return <div>⚠️ Node not found!</div>;

  const handleOptionClick = (optionId) => {
    const optionData = sampleNodes[optionId];
    if (!optionData) return;

    const timeTaken = (Date.now() - startTime) / 1000;
    console.log("Option selected:", optionData.data.label, "Time:", timeTaken, "s");

    if (optionData.next) {
      setCurrentNodeId(optionData.next);
    } else {
      setCurrentNodeId(optionData.id);
    }
  };

  const handleNext = () => {
    if (currentNode.data.next) setCurrentNodeId(currentNode.data.next);
  };

  const handleRestart = () => setCurrentNodeId(startNodeId);

  return (
  <div className="playthrough-container">
    <div className="node-visual-container">
      {/* ... Node Visual / Image content ... */}
      {currentNode.data.imageUrl && (
        <img
          className="node-visual"
          src={currentNode.data.imageUrl}
          alt="Node Visual"
        />
      )}
      {currentNode.scene && <p>{currentNode.scene}</p>}

      {/* NEW LOGIC: Check for the end-scenario condition first.
        The scenario is "over" if there are no options AND no 'next' link. 
      */}
      {!currentNode.options?.length && !currentNode.data.next ? (
        // 1. SHOW ONLY THE END SCENARIO BLOCK
        <div className="promptBox">
          <div className="end-scenario-container">
            <span className="end-scenario-heading">✅End of scenario</span>
            <button className="end-scenario-buttons" onClick={handleRestart} >
              Restart
            </button>
            <button
              className="end-scenario-buttons" onClick={() => navigate("/scene-editor")}
             
            >
              Back to Editor
            </button>
          </div>
        </div>
      ) : (
        // 2. SHOW THE REGULAR PROMPT BOX (OPTIONS or NEXT button)
        <section className="promptBox">
          <div className="current-node-label-container">
            <span className="current-node-label">{currentNode.data.label}</span>
          </div>
          <div className="optionsWrapper">
            {/* The old 'end-scenario' logic is now gone, 
               and we only deal with Options or Next */}
            {currentNode.options?.length > 0 ? (
              currentNode.options.map((optId) => (
                <OptionNode
                  key={optId}
                  option={sampleNodes[optId].data}
                  onClick={() => handleOptionClick(optId)}
                />
              ))
            ) : (
              // This is the remaining case: Only a 'next' property exists
              <button onClick={handleNext} style={{ padding: 10, marginTop: 10 }}>
                Next
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  </div>
);
};

export default ScenarioInterface;
