import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Global.css";
import "../styles/ScenarioInterface.css";
import OptionNode from "../components/OptionNode.jsx";

const ScenarioInterface = ({ onOptionSelect, isFinished, onGoToReport }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Get flow data
  const flowDataFromState = location.state?.flowData;
  const flowDataFromStorage = JSON.parse(localStorage.getItem("latestFlow") || "null");
  const flowData = flowDataFromState || flowDataFromStorage;

  // Determine start node
  const startNodeId = flowData?.startNodeId || flowData?.nodes?.[0]?.id || null;
  const [currentNodeId, setCurrentNodeId] = useState(startNodeId);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    setStartTime(Date.now());
  }, [currentNodeId]);

  if (!flowData || !flowData.nodes || flowData.nodes.length === 0) {
    return (
      <div>
        ⚠️ No scenario data found. Go back to{" "}
        <button onClick={() => navigate("/scene-editor")}>Editor</button>
      </div>
    );
  }

  const currentNode = flowData.nodes.find((n) => n.id === currentNodeId);
  if (!currentNode) return <div>⚠️ Node not found!</div>;

  // Access node fields safely
  const { data_description, options = [], next, imageUrl, scene } = currentNode.data;

  const handleOptionClick = (optionId) => {
    const nextNode = flowData.nodes.find((n) => n.id === optionId);
    if (!nextNode) return console.warn(`⚠️ Could not find node with ID '${optionId}'`);

    const timeTaken = (Date.now() - startTime) / 1000;
    if (onOptionSelect) onOptionSelect(nextNode, timeTaken);

    setCurrentNodeId(optionId);
  };

  const handleNext = () => {
    if (next) setCurrentNodeId(next);
  };

  const handleRestart = () => setCurrentNodeId(startNodeId);

  return (
    <div className="playthrough-container">
      <div className="node-visual-container">
        {imageUrl && (
          <img className="node-visual" src={imageUrl} alt="Node Visual" />
        )}

        {scene && <p>{scene}</p>}

        {/* --- END OF SCENARIO --- */}
        {options.length === 0 && !next ? (
          <div className="promptBox">
            <div className="end-scenario-container">
              <span className="end-scenario-heading">✅ End of scenario</span>
              <button className="end-scenario-buttons" onClick={handleRestart}>
                Restart
              </button>
              <button
                className="end-scenario-buttons"
                onClick={() => navigate("/scene-editor")}
              >
                Back to Editor
              </button>
            </div>
          </div>
        ) : (
          /* --- NORMAL SCENARIO BLOCK --- */
          <section className="promptBox">
            <p>{data_description}</p>

            <div className="optionsWrapper">
              {isFinished ? (
                <div className="report-navigation">
                  <p>You have reached the end of the playthrough.</p>
                  <button onClick={onGoToReport} className="restart-button">
                    View Your Report
                  </button>
                </div>
              ) : (
                options.map((optionId) => {
                  const optionNode = flowData.nodes.find((n) => n.id === optionId);
                  if (!optionNode) return null;

                  return (
                    <OptionNode
                      key={optionNode.id}
                      option={optionNode.data.data_description} // <-- only string
                      onClick={() => handleOptionClick(optionNode.id)}
                    />
                  );
                })
              )}
            </div>

            {next && options.length === 0 && (
              <button onClick={handleNext} className="next-button">
                Next
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default ScenarioInterface;
