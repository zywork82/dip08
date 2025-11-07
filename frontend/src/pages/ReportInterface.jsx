import React from 'react';
//Import Line AND Radar chart components
import {
  Chart as ChartJS,
  // Line
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  // Radar
  RadialLinearScale,
  Filler,
  // Common
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2'; // Import both

//Import jsPDF, autoTable, AND html2canvas
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas'; // Import html2canvas

//Register ALL chart components (Line and Radar)
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

const ReportInterface = async ({ data, onRestart }) => {
  //Data formatting remains the same
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
// --- (Analysis Function 1: Time Analysis) ---
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

// --- (Analysis Function 2: Psychological Profile for PDF & Radar) ---
// This function now returns data for BOTH the PDF summary AND the Radar Chart
const calculateProfileData = (data) => {
  if (!data || data.length === 0) {
    return { descriptions: [], avgTime: 0, labels: [], scores: [] };
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

  const descriptions = [
    `Bias Profile: ${biasScore > 60 ? 'Leans towards common biases.' : biasScore < 40 ? 'Tends to be reflective.' : 'Balanced.'}`,
    `Risk Tolerance: ${riskScore > 60 ? 'Risk-Seeking' : riskScore < 40 ? 'Risk-Averse' : 'Calculated.'}`,
    `Orientation: ${orientationScore > 60 ? 'Efficiency-Driven' : orientationScore < 40 ? 'Relationship-Driven' : 'Balanced.'}`,
    `Thinking Disposition: ${thinkingScore > 60 ? 'Analytical' : thinkingScore < 40 ? 'Intuitive' : 'Balanced.'}`
  ];
  
  const labels = [
    'Bias Profile', 
    'Risk Tolerance', 
    'Time vs. Relationship', 
    'Critical Thinking'
  ];
  
  const scores = [
    biasScore,
    riskScore,
    orientationScore,
    thinkingScore
  ];

  return { descriptions, avgTime, labels, scores };
};

// --- (Helper Function 3: Get Individual Score Text for Table) ---
const getScoreDescriptions = (scores) => {
  if (!scores) return { bias: 'N/A', risk: 'N/A', orientation: 'N/A', thinking: 'N/A' };
  
  const bias = (scores.bias_confirmation || 0) + (scores.bias_confidence || 0);
  return {
    bias: bias > 0 ? 'Bias Leaning' : bias < 0 ? 'Reflective' : 'Neutral',
    risk: (scores.risk_tolerance || 0) > 0 ? 'Risk-Seeking' : (scores.risk_tolerance || 0) < 0 ? 'Risk-Averse' : 'Neutral',
    orientation: (scores.time_vs_relationship || 0) > 0 ? 'Efficiency-Driven' : (scores.time_vs_relationship || 0) < 0 ? 'Relationship-Driven' : 'Neutral',
    thinking: (scores.thinking_disposition || 0) > 0 ? 'Analytical' : (scores.thinking_disposition || 0) < 0 ? 'Intuitive' : 'Neutral',
  };
};

// --- The Report Component ---
const ReportInterface = ({ data, onRestart }) => {
  
  // Prepare data for the Line Chart
  const { chartData: lineData, chartOptions: lineOptions } = prepareLineChartData(data);
  // Prepare data for the Radar Chart and PDF Summary
  const { descriptions, avgTime, labels: radarLabels, scores: radarScores } = calculateProfileData(data);

  // PDF Generation Function ---
  // Make the function 'async' to await html2canvas
  const generatePDFReport = async () => { 
    try {
      // Generate Chart Image ---
      // Get the hidden chart element
      const chartElement = document.getElementById('radar-for-pdf');
      if (!chartElement) {
        throw new Error("Could not find chart element for PDF generation.");
      }
      // Run html2canvas to "screenshot" it
      const canvas = await html2canvas(chartElement, { 
        scale: 2, // Higher scale for better resolution
        backgroundColor: null // Use transparent background
      });
      const imgData = canvas.toDataURL('image/png');

      // Create PDF Document
      const doc = new jsPDF();

      // Add Title
      doc.setFontSize(18);
      doc.text('Psychological Profile Report', 14, 22);

      // Add Radar Chart Image
      // (image data, type, x, y, width, height)
      // We set width to 180mm (approx 7in) and calculate height to maintain aspect ratio
      const imgWidth = 180;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      doc.addImage(imgData, 'PNG', 14, 30, imgWidth, imgHeight);

      // --- E. Add Summary Section (below the chart) ---
      const summaryYStart = 30 + imgHeight + 10; // 10mm padding
      doc.setFontSize(14);
      doc.text('Profile Summary', 14, summaryYStart);
      doc.setFontSize(11);
      doc.text(`Average Decision Time: ${avgTime.toFixed(2)} seconds`, 14, summaryYStart + 7);
      
      let yPos = summaryYStart + 15;
      descriptions.forEach(desc => {
        doc.text(`• ${desc}`, 16, yPos);
        yPos += 7;
      });

      //Add Choice-by-Choice Mapping Table ---
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Detailed Choice Analysis', 14, 22);

      const tableHead = [['Choice Made (Abbreviated)', 'Time (s)', 'Bias', 'Risk', 'Orientation', 'Thinking']];
      const tableBody = data.map(entry => {
        const scoreText = getScoreDescriptions(entry.scores);
        return [
          entry.choice.length > 40 ? entry.choice.substring(0, 40) + '...' : entry.choice,
          entry.timeTaken,
          scoreText.bias,
          scoreText.risk,
          scoreText.orientation,
          scoreText.thinking,
        ];
      });

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 30,
        theme: 'grid',
      });

      // --- G. Save the PDF ---
      doc.save('Your_Scenario_Report.pdf');

    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("An error occurred while generating the PDF report.");
    }
  };

  // --- Radar Chart Configuration (for the hidden chart) ---
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
    // Disable animations so html2canvas captures the final state
    animation: { duration: 0 }, 
    scales: { 
      r: { 
        angleLines: { color: 'rgba(0, 0, 0, 0.1)' }, 
        grid: { color: 'rgba(0, 0, 0, 0.1)' }, 
        pointLabels: { font: { size: 14 } }, 
        ticks: { backdropColor: 'white', beginAtZero: true, max: 100, min: 0, stepSize: 20 } 
      } 
    },
    plugins: { 
      legend: { position: 'top' }, 
      title: { display: true, text: 'Playthrough Psychological Analysis', font: { size: 20 } } 
    },
  };

  // --- Main Render ---
  return (
    <div className="report-container" style={{ padding: '2rem', textAlign: 'center' }}>
      
      {/* 5. HIDDEN RADAR CHART for PDF generation */}
      {/* This is positioned off-screen so the user doesn't see it, */}
      {/* but html2canvas can still render it. */}
      <div 
        id="radar-for-pdf" 
        style={{ 
          position: 'absolute', 
          left: '-9999px', 
          top: '-9999px', 
          width: '700px', // Give it a defined size
        }}
      >
        <Radar data={radarData} options={radarOptions} />
      </div>

      <h1>Your Report</h1>
      
      {/* Time Analysis (Default View) */}
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

      <hr style={{ maxWidth: '700px', margin: '2rem auto' }} />

      {/* 7. PDF Download Section */}
      <div className="pdf-download-section">
        <h2>Full Psychological Profile</h2>
        <p>Download a detailed PDF report of your profile, including a full breakdown of each choice.</p>
        <button 
          onClick={generatePDFReport} 
          className="pdf-button" 
          style={{ fontSize: '1.1rem', padding: '0.8rem 1.5rem', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Download PDF Report 📄
        </button>
      </div>

      <button onClick={onRestart} className="restart-button" style={{ fontSize: '1.2rem', padding: '0.8rem 1.5rem', cursor: 'pointer', marginTop: '3rem' }}>
        Play Again 🔄
      </button>
    </div>
  );
};

export default ReportInterface;