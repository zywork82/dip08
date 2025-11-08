import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  // Line
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Radar } from "react-chartjs-2";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend
);

// ========== Helper 1: Prepare line chart ==========
const prepareLineChartData = (data = []) => {
  if (!Array.isArray(data)) data = [];
  const labels = data.map((entry, index) => `Choice ${index + 1}`);
  const times = data.map(entry => entry.timeTaken);

  await fetch("http://localhost:8000/api/analytics/playthrough", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "user123",
    scenario_id: "scenario1",
    choices: data.map(d => ({
      node_id: d.nodeId,
      selected_option: d.choice,
      time_taken: d.timeTaken,
    }))
  }),
});

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

      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={() => navigate("/simulation", { state: { scenarioId, flowData } })}
          style={{
            fontSize: "1.1rem",
            padding: "0.8rem 1.5rem",
            cursor: "pointer",
          }}
        >
          🔄 Play Again
        </button>
      </div>
    </div>
  );
};
}

export default ReportInterface;

