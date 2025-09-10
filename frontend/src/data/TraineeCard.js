import React from 'react';
import { FaChevronRight } from 'react-icons/fa'; // A popular icon library

const TraineeCard = ({ trainee }) => {
  // Conditional styling based on assessment status
  const cardColor = trainee.status === 'Assessed' ? '#D6F2C2' : '#F9D8D6';
  const textColor = trainee.status === 'Assessed' ? '#4A6044' : '#8A5856';

  const cardStyle = {
    backgroundColor: cardColor,
    color: textColor,
    padding: '20px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  };

  const imageStyle = {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    marginRight: '15px',
  };

  const textContainerStyle = {
    flex: 1,
  };

  return (
    <div style={cardStyle}>
      <img src={trainee.image} alt={`${trainee.name}'s profile`} style={imageStyle} />
      <div style={textContainerStyle}>
        <h3 style={{ margin: '0 0 5px', fontSize: '1.2rem', fontWeight: '600' }}>{trainee.name}</h3>
        <p style={{ margin: '0', fontSize: '0.9rem' }}>{trainee.role}</p>
        <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
          {trainee.status === 'Assessed' ? `Assessed on ${trainee.date}` : 'Unassessed'}
        </p>
      </div>
      <FaChevronRight style={{ fontSize: '1.5rem', opacity: '0.4' }} />
    </div>
  );
};

export default TraineeCard;