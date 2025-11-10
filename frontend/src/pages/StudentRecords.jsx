import React, { useState, useEffect } from 'react';
import { FaSearch, FaRedo, FaTimes, FaDownload } from 'react-icons/fa';
import { traineeData } from '../data/TraineeData.js';
import StudentSidebar from '../components/StudentSidebar.jsx';
import SharedHeader from '../components/SharedHeader';
import TraineeReportModal from '../components/TraineeReportModal.jsx';


const TraineeRecordsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('latest'); // default to latest
  const [filters, setFilters] = useState({
    date: '',
    caseStudy: '',
    status: '',
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState(null);

  // Filter
  const filteredTrainees = traineeData.filter((trainee) => {
    const matchesSearch = trainee.caseStudy
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesDate = !filters.date || trainee.date === filters.date;
    const matchesCaseStudy = !filters.caseStudy || trainee.caseStudy === filters.caseStudy;
    const matchesStatus = !filters.status || trainee.status === filters.status;

    return matchesSearch && matchesDate && matchesCaseStudy && matchesStatus;
  });

  // Sort - apply on top of filteredTrainees
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
      <StudentSidebar />
      <div style={mainContentStyle}>
        <SharedHeader
          profileImage={`https://placehold.co/100x100/E6E6FA/3f51b5?text=HW`}
        />

        <div style={bodyStyle}>
          <h2 style={titleStyle}>My Records</h2>
          <div style={filterRowStyle}>
            <div style={searchBoxStyle}>
              <FaSearch style={{ color: '#aaa' }} />
              <input
                type="text"
                placeholder="Search for Case Study"
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
                <th style={thStyle}>Case Study</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Report</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrainees.map((trainee) => (
                <tr key={trainee.id}>
                  <td style={tdStyle}>{trainee.id}</td>
                  <td style={tdStyle}>{trainee.caseStudy}</td>
                  <td style={tdStyle}>{trainee.date}</td>
                  <td style={tdStyle}>
                    <span style={linkStyle} onClick={() => handleViewReport(trainee)}>
                      View
                    </span>
                  </td>
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