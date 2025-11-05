import React, { useState, useEffect } from 'react';
import { FaSearch, FaRedo, FaTimes, FaDownload } from 'react-icons/fa';
import { traineeData } from '../data/TraineeData.js';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';

// Mock data for the report's internal details
const reportData = {
  // Renamed to match the key in traineeData
  caseStudy: 'Cybersecurity Awareness',
  totalTimeSpent: '32 minutes',
  decisionTimeline: [
    { step: 1, decision: 'D1', timeTaken: 5, correct: true },
    { step: 2, decision: 'D2', timeTaken: 8, correct: false },
    { step: 3, decision: 'D3', timeTaken: 3, correct: true },
    { step: 4, decision: 'D4', timeTaken: 10, correct: false },
    { step: 5, decision: 'D5', timeTaken: 6, correct: true },
  ]
};

// New Modal Component
const TraineeReportModal = ({ trainee, onClose }) => {
  
  if (!trainee) return null;

  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  };

  const modalContentStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '800px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
  };

  const modalHeaderStyle = {
    backgroundColor: '#5B50A7',
    color: '#fff',
    padding: '1rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: '12px',
    borderTopRightRadius: '12px',
  };

 const modalBodyStyle = {
  padding: '20px 0 0 20px', // top right bottom left
  overflowY: 'auto',
  flexGrow: 1,
};

  const reportTitleStyle = {
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: '2rem',
    color: '#333',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '2rem',
  };

  const tableHeaderStyle = {
    fontWeight: 600,
    textAlign: 'left',
    padding: '12px',
  };

  const tableCellStyle = {
    padding: '10px',
    border: '1px solid #ddd',
  };

  const downloadButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '2rem auto 0',
    padding: '12px 24px',
    backgroundColor: '#5B50A7',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500,
  };

  const closeButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem',
    width: '32px',
    height: '32px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };



  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <div style={modalHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Analytics Report for {trainee.name}</h3>
          <button onClick={onClose} style={closeButtonStyle}>
            <FaTimes />
          </button>
        </div>
        <div style={modalBodyStyle}>
          <h4 style={reportTitleStyle}>Trainee Performance Report</h4>
          
          <div style={tableStyle}>
            <table>
              <tbody>
                <tr><td style={{...tableCellStyle, fontWeight: 600, backgroundColor: '#f5f5f5', width: '30%'}}>Trainee Name:</td><td style={tableCellStyle}>{trainee.name}</td></tr>
                <tr><td style={{...tableCellStyle, fontWeight: 600, backgroundColor: '#f5f5f5', width: '30%'}}>Trainee ID:</td><td style={tableCellStyle}>{trainee.id}</td></tr>
                {/* Now using trainee.caseStudy */}
                <tr><td style={{...tableCellStyle, fontWeight: 600, backgroundColor: '#f5f5f5', width: '30%'}}>Case Study:</td><td style={tableCellStyle}>{trainee.caseStudy}</td></tr>
                {/* Now using trainee.date */}
                <tr><td style={{...tableCellStyle, fontWeight: 600, backgroundColor: '#f5f5f5', width: '30%'}}>Date:</td><td style={tableCellStyle}>{trainee.date}</td></tr>
                <tr><td style={{...tableCellStyle, fontWeight: 600, backgroundColor: '#f5f5f5', width: '30%'}}>Total Time Spent:</td><td style={tableCellStyle}>{reportData.totalTimeSpent}</td></tr>
                {/* Now using trainee.status */}
                <tr><td style={{...tableCellStyle, fontWeight: 600, backgroundColor: '#f5f5f5', width: '30%'}}>Completion Status:</td><td style={tableCellStyle}>{trainee.status}</td></tr>
              </tbody>
            </table>
          </div>

          <h5 style={{fontWeight: 600, marginBottom: '1rem'}}>Decision Timeline</h5>
          <div style={tableStyle}>
            <table>
              <thead>
                <tr style={{backgroundColor: '#e8e8ff'}}>
                  <th style={tableHeaderStyle}>Step</th>
                  <th style={tableHeaderStyle}>Decision</th>
                  <th style={tableHeaderStyle}>Time Taken (s)</th>
                  <th style={tableHeaderStyle}>Correct?</th>
                </tr>
              </thead>
              <tbody>
                {reportData.decisionTimeline.map((item, index) => (
                  <tr key={index}>
                    <td style={tableCellStyle}>{item.step}</td>
                    <td style={tableCellStyle}>{item.decision}</td>
                    <td style={tableCellStyle}>{item.timeTaken}</td>
                    <td style={tableCellStyle}>{item.correct ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button style={downloadButtonStyle}>
            Download Report <FaDownload style={{marginLeft: '8px'}} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Main TraineeRecordsPage component
const TraineeRecordsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('latest'); 
  const [filters, setFilters] = useState({
    date: '',
    caseStudy: '',
    status: '',
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState(null);

  const filteredTrainees = traineeData.filter((trainee) => {
    const matchesSearch = trainee.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesDate = !filters.date || trainee.date === filters.date;
    const matchesCaseStudy = !filters.caseStudy || trainee.caseStudy === filters.caseStudy;
    const matchesStatus = !filters.status || trainee.status === filters.status;

    return matchesSearch && matchesDate && matchesCaseStudy && matchesStatus;
  });

    const sortedTrainees = [...filteredTrainees].sort((a, b) => {
    // Parse dates into timestamps; fallback to 0 if invalid
    const dateA = new Date(a.date).getTime() || 0;
    const dateB = new Date(b.date).getTime() || 0;

    if (sort === 'latest') {
      return dateB - dateA; // newest first
    }
    if (sort === 'earliest') {
      return dateA - dateB; // oldest first
    }
    return 0;
  });


  const resetFilters = () => {
    setFilters({ date: '', caseStudy: '', status: '' });
    setSearchQuery('');
  };

  const handleViewReport = (trainee) => {
    setSelectedTrainee(trainee);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTrainee(null);
  };

  const statusBadge = (status) => {
    const colors = {
      Completed: { bg: '#E6F7F1', color: '#2ECC71' },
      Processing: { bg: '#F3E8FF', color: '#9B59B6' },
      Rejected: { bg: '#FDEDEC', color: '#E74C3C' },
      'On Hold': { bg: '#FEF5E7', color: '#E67E22' },
      'In Transit': { bg: '#F0F4FF', color: '#5B50A7' },
    };
    const style = {
      backgroundColor: colors[status]?.bg || '#eee',
      color: colors[status]?.color || '#333',
      padding: '5px 10px',
      borderRadius: '12px',
      fontSize: '0.8rem',
      fontWeight: '500',
    };
    return <span style={style}>{status}</span>;
  };

  const containerStyle = {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#F8F8FC',
  };

  const mainContentStyle = {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  };

 const bodyStyle = {
  padding: '92px 0 0 220px', // more noticeable top and left
  overflowY: 'auto',
  flexGrow: 1,
};
  const titleStyle = {
    margin: '0 0 20px 0',
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#333',
  };

  const filterRowStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '15px',
  };

  const searchBoxStyle = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    flex: 1,
    maxWidth: '250px',
  };

  const searchInputStyle = {
    border: 'none',
    outline: 'none',
    marginLeft: '8px',
    flex: 1,
  };

  const selectStyle = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
  };

  const resetStyle = {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    color: '#E74C3C',
    fontWeight: '500',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#fff',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  };

  const thStyle = {
    textAlign: 'left',
    padding: '14px',
    backgroundColor: '#F4F4F9',
    fontWeight: '600',
    color: '#555',
    fontSize: '0.9rem',
  };

  const tdStyle = {
    padding: '14px',
    borderBottom: '1px solid #eee',
    fontSize: '0.9rem',
    color: '#333',
  };

  const linkStyle = {
    color: '#5B50A7',
    cursor: 'pointer',
    textDecoration: 'underline',
  };

  return (
    <div style={containerStyle}>
      <SharedSidebar />
      <div style={mainContentStyle}>
        <SharedHeader
          profileImage={`https://placehold.co/100x100/E6E6FA/3f51b5?text=A`}
        />

        <div style={bodyStyle}>
          <h2 style={titleStyle}>Trainee Records</h2>
          <div style={filterRowStyle}>
            <div style={searchBoxStyle}>
              <FaSearch style={{ color: '#aaa' }} />
              <input
                type="text"
                placeholder="Search for name"
                style={searchInputStyle}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="latest">Latest first</option>
                <option value="earliest">Earliest first</option>
              </select>
            <div style={resetStyle} onClick={resetFilters}>
              <FaRedo style={{ marginRight: '6px' }} />
              Reset Filter
            </div>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Case Study</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Report</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrainees.map((trainee) => (
                <tr key={trainee.id}>
                  <td style={tdStyle}>{trainee.id}</td>
                  <td style={tdStyle}>{trainee.name}</td>
                  <td style={tdStyle}>{trainee.caseStudy}</td>
                  <td style={tdStyle}>{trainee.date}</td>
                  <td style={tdStyle}>
                    <span style={linkStyle} onClick={() => handleViewReport(trainee)}>
                      View
                    </span>
                  </td>
                  <td style={tdStyle}>{statusBadge(trainee.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && <TraineeReportModal trainee={selectedTrainee} onClose={handleCloseModal} />}
    </div>
  );
};

export default TraineeRecordsPage;