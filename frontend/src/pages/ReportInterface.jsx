import React from 'react';
//Import the new components for a Line Chart
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement, // For the dots on the line
  LineElement,  // For the line itself
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

//Import the Line component instead of Bar
import { Line } from 'react-chartjs-2';

//Register the new elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ReportInterface = ({ data, onRestart }) => {
  //Data formatting remains the same
  const labels = data.map((entry, index) => `Choice ${index + 1}`);
  const times = data.map(entry => entry.timeTaken);

  //Chart data configuration remains largely the same
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Time Taken (seconds)',
        data: times,
        // Style adjustments for a line chart
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1 // Makes the line slightly curved
      },
    ],
  };

  //Chart options configuration remains the same
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'User Response Time per Choice',
        font: { size: 18 }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const entry = data[context.dataIndex];
            return `${entry.choice}: ${entry.timeTaken}s`;
          }
        }
      }
    },
    
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Time (seconds)'
        }
      },
      x: {
         title: {
          display: true,
          text: 'Sequence of Choices'
        }
      }
    }
  };

  return (
    <div className="report-container" style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>Playthrough Report</h1>
      <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
        {/* 4. Use the <Line /> component */}
        <Line options={chartOptions} data={chartData} />
      </div>

      {/* The rest of your component remains the same */}
      <div className="summary-list">
        <h2>Summary of Choices</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.map((entry, index) => (
            <li key={index} style={{ margin: '0.5rem 0' }}>
              <strong>Choice {index + 1}:</strong> {entry.choice} (<em>{entry.timeTaken}s</em>)
            </li>
          ))}
        </ul>
      </div>

      <button onClick={onRestart} className="restart-button" style={{ marginTop: '2rem', padding: '1rem 2rem', fontSize: '1rem', cursor: 'pointer' }}>
        Play Again 🔄
      </button>
    </div>
  );
};

export default ReportInterface;

