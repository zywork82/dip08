import React, { useState } from 'react';
import { FaSearch, FaArrowLeft } from 'react-icons/fa';
import TraineeCard from '../data/TraineeCard.js';
import { traineeData } from '../data/TraineeData.js';
import { useNavigate } from 'react-router-dom';

const TraineeRecordsPage = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const tabs = ['All', 'Unassessed', 'Assessed'];

  // Filter trainees based on the active tab and search query
  const filteredTrainees = traineeData.filter(trainee => {
    const matchesTab = 
      activeTab === 'All' || 
      (activeTab === 'Unassessed' && trainee.status === 'Unassessed') || 
      (activeTab === 'Assessed' && trainee.status === 'Assessed');
      
    const matchesSearch = trainee.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesTab && matchesSearch;
  });

  const pageStyle = {
    flex: 1,
    padding: '30px',
    backgroundColor: '#F0F0F5',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
  };

  const backButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    color: '#5B50A7',
    marginRight: '20px',
    fontSize: '1.5rem',
  };

  const tabsContainerStyle = {
    display: 'flex',
    marginBottom: '20px',
  };

  const tabStyle = (tabName) => ({
    padding: '10px 20px',
    marginRight: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: activeTab === tabName ? '600' : 'normal',
    color: activeTab === tabName ? '#5B50A7' : '#999',
    backgroundColor: activeTab === tabName ? '#E8E8FF' : 'transparent',
  });

  const searchContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: '12px',
    padding: '10px 20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    marginBottom: '30px',
  };

  const inputStyle = {
    border: 'none',
    outline: 'none',
    flex: 1,
    fontSize: '1rem',
    marginLeft: '10px',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '20px',
  };

  return (
    <div style={pageStyle}>
      {/* Back button */}
      <div style={headerStyle}>
        <div style={backButtonStyle} onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </div>
        <h2 style={{ margin: 0, color: '#333' }}>Trainee Records</h2>
      </div>

      <div style={tabsContainerStyle}>
        {tabs.map(tab => (
          <div key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {tab}
          </div>
        ))}
      </div>

      <div style={searchContainerStyle}>
        <FaSearch style={{ color: '#aaa' }} />
        <input 
          type="text" 
          placeholder="Search by name" 
          style={inputStyle} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={gridStyle}>
        {filteredTrainees.map(trainee => (
          <TraineeCard key={trainee.id} trainee={trainee} />
        ))}
      </div>
    </div>
  );
};

export default TraineeRecordsPage;
