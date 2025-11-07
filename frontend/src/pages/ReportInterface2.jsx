import React, { useState } from 'react';
// 1. Import all necessary components from Chart.js for BOTH charts
import {
  Chart as ChartJS,
  // Line Chart
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  // Radar Chart
  RadialLinearScale,
  Filler,
  // Common
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2'; // Import both chart types

// 2. Register all components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend
);

// --- (Analysis Function 1: Psychological Profile) ---
const analyzePsychData = (data) => {
  if (!data || data.length === 0) {
    return { labels: [], scores: [], descriptions: [] };
  }
  const getAverage = (arr) => {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((acc, val) => acc + val, 0) / arr.length;
  };
  
  const avgTime = getAverage(data.map(entry => entry.timeTaken));
  const avgBiasConfirmation = getAverage(data.map(entry => entry.scores.bias_confirmation || 0));
  const avgBiasConfidence = getAverage(data.map(entry => entry.scores.bias_confidence || 0));
  const avgRiskTolerance = getAverage(data.map(entry => entry.scores.risk_tolerance || 0));
  const avgTimeVsRelationship = getAverage(data.map(entry => entry.scores.time_vs_relationship || 0));
  const avgThinkingDisposition = getAverage(data.map(entry => entry.scores.thinking_disposition || 0));
  
  const biasScore = ( (avgBiasConfirmation + avgBiasConfidence) / 2 + 1) * 50;
  const riskScore = (avgRiskTolerance + 1) * 50;
  const orientationScore = (avgTimeVsRelationship + 1) * 50;
  const thinkingScore = (avgThinkingDisposition + 1) * 50;
  const analyticalDepthScore = Math.max(0, Math.min(100, (10 - avgTime) / (10 - 3) * 100));

  const descriptions = [
    `Bias Profile: ${biasScore > 60 ? 'Leans towards common biases.' : biasScore < 40 ? 'Tends to be reflective.' : 'Balanced.'}`,
    `Risk Tolerance: ${riskScore > 60 ? 'Risk-Seeking' : riskScore < 40 ? 'Risk-Averse' : 'Calculated.'}`,
    `Orientation: ${orientationScore > 60 ? 'Efficiency-Driven' : orientationScore < 40 ? 'Relationship-Driven' : 'Balanced.'}`,
    `Analytical Depth: ${analyticalDepthScore > 60 ? 'Processes information quickly (Fast/Intuitive).' : 'Takes time to process (Slow/Deliberate).'} (Avg: ${avgTime.toFixed(2)}s)`,
    `Thinking Disposition: ${thinkingScore > 60 ? 'Analytical' : thinkingScore < 40 ? 'Intuitive' : 'Balanced.'}`
  ];

  return {
    labels: ['Bias Profile', 'Risk Tolerance', 'Time vs. Relationship', 'Analytical Depth', 'Critical Thinking'],
    scores: [biasScore, riskScore, orientationScore, analyticalDepthScore, thinkingScore],
    descriptions: descriptions
  };
};

// --- (Analysis Function 2: Time Analysis) ---
const prepareLineChartData = (data) => {
  const labels = data.map((entry, index) => `Choice ${index + 1}`);
  const times = data.map(entry => entry.timeTaken);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Time Taken (seconds)',
        data: times,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.1
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Response Time per Choice' },
      tooltip: {
        callbacks: {
          label: function(context) {
            // Show the full choice text on hover
            return data[context.dataIndex]?.choice || '';
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Time (seconds)' }
      }
    }
  };
  
  return { chartData, chartOptions };
};


// --- The Report Component ---
const ReportInterface = ({ data, onRestart }) => {
  // 3. State to manage which view is active
  const [view, setView] = useState('time'); // 'time' or 'psych'

  // 4. Prepare data for both charts
  const { chartData: lineData, chartOptions: lineOptions } = prepareLineChartData(data);
  const { labels: radarLabels, scores: radarScores, descriptions: psychDescriptions } = analyzePsychData(data);

  // Radar chart data and options (defined here for clarity)
  const radarData = {
    labels: radarLabels,
    datasets: [{
      label: 'Your Psychological Profile',
      data: radarScores,
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
    }],
  };
  const radarOptions = {
    responsive: true,
    scales: { r: { angleLines: { color: 'rgba(0, 0, 0, 0.1)' }, grid: { color: 'rgba(0, 0, 0, 0.1)' }, pointLabels: { font: { size: 14 } }, ticks: { backdropColor: 'white', beginAtZero: true, max: 100, min: 0, stepSize: 20 } } },
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Playthrough Psychological Analysis', font: { size: 20 } } },
  };

  return (
    <div className="report-container" style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Your Report</h1>

      {/* 5. Toggle Buttons */}
      <div className="view-toggle" style={{ margin: '1rem 0' }}>
        <button 
          onClick={() => setView('time')}
          style={view === 'time' ? { fontWeight: 'bold', borderBottom: '2px solid blue' } : {}}
        >
          Time Analysis
        </button>
        <button 
          onClick={() => setView('psych')}
          style={view === 'psych' ? { fontWeight: 'bold', borderBottom: '2px solid blue' } : { marginLeft: '1rem' }}
        >
          Psychological Profile
        </button>
      </div>

      {/* 6. Conditional Rendering */}
      {view === 'time' && (
        <div className="time-report">
          <div style={{ width: '80%', maxWidth: '700px', margin: 'auto' }}>
            <Line options={lineOptions} data={lineData} />
          </div>
          <div className="summary-list" style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '700px', margin: '2rem auto' }}>
            <h2>Summary of Choices</h2>
            <ul>
              {data.map((entry, index) => (
                <li key={index} style={{ fontSize: '1.1rem', margin: '0.5rem 0' }}>
                  <strong>Choice {index + 1}:</strong> {entry.choice} (<em>{entry.timeTaken}s</em>)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {view === 'psych' && (
        <div className="psych-report">
          <div style={{ width: '80%', maxWidth: '700px', margin: 'auto' }}>
            <Radar options={radarOptions} data={radarData} />
          </div>
          <div className="summary-list" style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '700px', margin: '2rem auto' }}>
            <h2>Analysis Breakdown</h2>
            <ul>
              {psychDescriptions.map((desc, index) => (
                <li key={index} style={{ fontSize: '1.1rem', margin: '0.5rem 0' }}>{desc}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <button onClick={onRestart} className="restart-button" style={{ fontSize: '1.2rem', padding: '0.8rem 1.5rem', cursor: 'pointer', marginTop: '2rem' }}>
        Play Again 🔄
      </button>
    </div>
  );
};

export default ReportInterface2;

