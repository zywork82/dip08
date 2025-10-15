// src/components/OptionNode.jsx
import React from "react";
import "../styles/OptionNode.css";

const OptionNode = ({ option, onClick, isSelected }) => {
  return (
    <div
      className={`option-node ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    
    >
      {option.label || "Option"}
    </div>
  );
};

export default OptionNode;
