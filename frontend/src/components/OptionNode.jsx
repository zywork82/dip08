import React from 'react';

// ADDED: The 'onClick' function is now a prop
const OptionNode = ({ option, onClick }) => {
  if (!option) {
    return null;
  }

  return (
    <button className="option-button" onClick={onClick}>
      {option.data.label}
    </button>
  );
};

export default OptionNode;