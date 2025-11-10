import React, { useState, useEffect } from 'react';
import { FaSearch, FaRedo, FaTimes, FaDownload } from 'react-icons/fa';
import { traineeData } from '../data/TraineeData.js';
import StudentSidebar from './StudentSidebar.jsx';
import SharedHeader from './SharedHeader.jsx';


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
export default TraineeReportModal;