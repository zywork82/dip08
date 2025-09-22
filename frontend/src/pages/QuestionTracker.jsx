import { useState, useEffect } from "react";

const QuestionTracker = ({ questions, onAnswer }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    setStartTime(Date.now()); // reset timer on question change
  }, [currentQuestion]);

  const handleOptionClick = (option) => {
    const endTime = Date.now();
    const timeTaken = Math.round((endTime - startTime) / 1000); // seconds

    onAnswer({
      questionId: currentQuestion.id,
      option,
      timeTaken,
    });

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="question-tracker">
      <h2>{currentQuestion.text}</h2>
      <div className="options">
        {currentQuestion.options.map((opt) => (
          <button key={opt} onClick={() => handleOptionClick(opt)}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuestionTracker;
