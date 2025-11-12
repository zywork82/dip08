import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale, // For Radar Chart
  Filler,           // For Radar Chart
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Radar } from "react-chartjs-2"; // Import both
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import StudentSidebar from "../components/StudentSidebar.jsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale, // Registered for Radar Chart
  Filler,           // Registered for Radar Chart
  Title,
  Tooltip,
  Legend
);

// --- This is the database save function ---
const saveReportToDB = async (payload) => {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/analytics/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log("✅ Report saved:", data);
  } catch (err) {
    console.error("❌ Error saving report:", err);
  }
};

// ========== Helper 1: Prepare line chart ==========
const prepareLineChartData = (data = []) => {
  if (!Array.isArray(data)) data = [];
  const labels = data.map((entry, index) => `Choice ${index + 1}`);
  const times = data.map((entry) => entry.timeTaken);

  return {
    chartData: {
      labels,
      datasets: [
        {
          label: "Time Taken (seconds)",
          data: times,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          fill: true,
          tension: 0.1,
        },
      ],
    },
    chartOptions: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: "Response Time per Choice" },
        tooltip: {
          callbacks: {
            // Show the full choice text on hover
            label: function(context) {
              return data[context.dataIndex]?.choice || '';
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Seconds" } },
      },
    },
  };
};

// ========== Helper 2: NEW Psychological analysis ==========
// This function calculates the new profile based on your 4 dimensions
const calculateProfileData = (data = []) => {
  
  // 1. Initialize counts for ONLY your 4 dimensions + Other
  const counts = {
    "Confidence Bias": 0,
    "Risk Seeking": 0,
    "Time Orientation": 0,
    "Critical Thinking": 0,
    "Other": 0,
  };
  
  const timeSums = {
    "Confidence Bias": 0,
    "Risk Seeking": 0,
    "Time Orientation": 0,
    "Critical Thinking": 0,
    "Other": 0,
  };

  let totalTime = 0;
  let totalChoices = data.length;

  if (totalChoices === 0) {
    return {
      counts: {},
      avgTimes: {},
      archetype: "Not Enough Data",
      summary: "Play a scenario to see your profile.",
      avgTime: 0,
      radarLabels: [],
      radarScores: [],
      descriptions: [],
    };
  }

  // 2. Loop through choices and count dimensions
  for (const entry of data) {
    const dim = entry.dimension; // e.g., "Time Orientation"
    
    if (counts.hasOwnProperty(dim)) {
      counts[dim]++;
      timeSums[dim] += entry.timeTaken;
    } else {
      counts["Other"]++; // Catch-all for misspellings or "Risk-averse" etc.
      timeSums["Other"] += entry.timeTaken;
    }
    totalTime += entry.timeTaken;
  }

  // 3. Calculate averages
  const avgTimes = {};
  for (const dim in counts) {
    avgTimes[dim] = counts[dim] > 0 ? timeSums[dim] / counts[dim] : 0;
  }
  const avgTime = totalTime / totalChoices;

  // 4. Archetype Logic (Based on the 4 counts)
  let archetype = "Balanced Thinker";
  let summary = "You show a balanced approach to your decisions, with no single trait dominating.";

  // Find the dominant dimension (excluding "Other")
  const primaryDimensions = {
    "Confidence Bias": counts["Confidence Bias"],
    "Risk Seeking": counts["Risk Seeking"],
    "Time Orientation": counts["Time Orientation"],
    "Critical Thinking": counts["Critical Thinking"],
  };
  
  const maxCount = Math.max(...Object.values(primaryDimensions));
  
  if (maxCount > 0) {
    const dominantDims = Object.keys(primaryDimensions).filter(
      dim => primaryDimensions[dim] === maxCount
    );

    if (dominantDims.length > 1) {
      archetype = "Balanced Thinker";
      summary = `You show a balanced approach, weighing ${dominantDims.join(' and ')} equally.`;
    } else {
      const mostChosenDim = dominantDims[0];
      const avgTimeForDim = avgTimes[mostChosenDim];

      // Logic based on the single dominant dimension
      if (mostChosenDim === "Risk Seeking") {
        if (avgTimeForDim < 5.0) { 
          archetype = "Impulsive Risk-Seeker";
          summary = `Your dominant trait is **Risk Seeking**. You tend to make these decisions very quickly (avg ${avgTimeForDim.toFixed(1)}s).`;
        } else { 
          archetype = "Calculated Risk-Seeker";
          summary = `Your dominant trait is **Risk Seeking**. You favor taking risks, but you take your time to consider them (avg ${avgTimeForDim.toFixed(1)}s).`;
        }
      } else if (mostChosenDim === "Time Orientation") {
        archetype = "Efficient Pragmatist";
        summary = `Your dominant trait is **Time Orientation**. You are primarily driven by efficiency and finding the quickest path.`;
      } else if (mostChosenDim === "Critical Thinking") {
        if (avgTimeForDim > 10.0) { 
          archetype = "Deliberate Analyst";
          summary = `Your dominant trait is **Critical Thinking**. You prefer to analyze situations deeply before acting (avg ${avgTimeForDim.toFixed(1)}s).`;
        } else {
          archetype = "Quick Thinker";
          summary = `Your dominant trait is **Critical Thinking**. You process problems quickly to find a structured solution (avg ${avgTimeForDim.toFixed(1)}s).`;
        }
      } else if (mostChosenDim === "Confidence Bias") {
         archetype = "Intuitive Leader";
         summary = `Your dominant trait is **Confidence Bias**. You tend to trust your intuition and act with conviction.`;
      }
    }
  }

  // 5. Prepare data for Radar Chart and PDF
  const radarLabels = [
    "Confidence Bias",
    "Risk Seeking",
    "Time Orientation",
    "Critical Thinking"
  ];
  
  // Calculate scores as a percentage of *total primary choices*
  const totalPrimaryChoices = Object.values(primaryDimensions).reduce((a, b) => a + b, 0);

  const radarScores = radarLabels.map(dim => 
    totalPrimaryChoices === 0 ? 0 : (primaryDimensions[dim] / totalPrimaryChoices) * 100
  );
  
  const descriptions = radarLabels.map(dim => {
      const count = primaryDimensions[dim];
      const time = avgTimes[dim];
      return `**${dim}**: Chosen ${count} time${count === 1 ? '' : 's'}. (Avg. Time: ${time.toFixed(1)}s)`;
  });

  return { counts, avgTimes, archetype, summary, avgTime, radarLabels, radarScores, descriptions };
};

// ========== Main Component ==========
const ReportInterface = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { scenarioId, choicesLog = [], flowData } = location.state || {};
  const currentUser = JSON.parse(localStorage.getItem("user"));

  // --- Create the 'data' variable with REAL data ---
  const nodeMap = useMemo(() => {
    if (!flowData || !flowData.nodes) return new Map();
    // Create a Map for fast lookups by ID
    return new Map(flowData.nodes.map((n) => [n.id, n]));
  }, [flowData]);

  const data = useMemo(() => {
    if (!choicesLog || !nodeMap.size) return [];
    
    return choicesLog.map((log) => {
      const node = nodeMap.get(log.optionId);
      
      const choiceText = node?.data?.data_description || node?.data?.data || `Option ${log.optionId}`;
      
      // Get the dimension string, clean it, and default to "Other"
      // This logic correctly finds "Time Orientation" from "\"Time Orientation\""
      const dimension = (node?.data?.psych_dimensions || "Other").replace(/"/g, '');
      
      return {
        choice: choiceText,
        timeTaken: log.timeTaken || 0,
        dimension: dimension,
      };
    });
  }, [choicesLog, nodeMap]);
  // --- END: 'data' variable is fixed ---

  // Run all analyses based on the real data
  const { 
    chartData: lineData, 
    chartOptions: lineOptions 
  } = prepareLineChartData(data);
  
  const { 
    counts, 
    avgTimes, 
    archetype, 
    summary, 
    avgTime, 
    radarLabels, 
    radarScores,
    descriptions // Get descriptions for PDF
  } = calculateProfileData(data); 

  // --- Auto-save the report ---
  useEffect(() => {
    const autoSaveReport = async () => {
      if (data.length === 0 || !currentUser) return; // Don't save empty reports

      const payload = {
        user_id: currentUser?.id || "test_user", 
        scenario_id: scenarioId || "unknown_scenario",
        archetype: archetype, 
        avgTime: avgTime.toFixed(2),
        counts: { // Send only the 4 primary counts
          "Confidence Bias": counts["Confidence Bias"],
          "Risk Seeking": counts["Risk Seeking"],
          "Time Orientation": counts["Time Orientation"],
          "Critical Thinking": counts["Critical Thinking"],
        },
        avgTimes: { // Send only the 4 primary avg times
          "Confidence Bias": avgTimes["Confidence Bias"],
          "Risk Seeking": avgTimes["Risk Seeking"],
          "Time Orientation": avgTimes["Time Orientation"],
          "Critical Thinking": avgTimes["Critical Thinking"],
        },
        radarScores: radarScores, // Send the 0-100 scores
        choices: data.map((entry) => ({ 
          choice: entry.choice,
          timeTaken: entry.timeTaken,
          dimension: entry.dimension,
        })),
      };

      await saveReportToDB(payload);
    };

    autoSaveReport();
  }, [data, archetype, avgTime, counts, avgTimes, scenarioId, currentUser, radarScores]);


  // 🩹 Safety: if user comes here with no data
  if (!choicesLog.length) {
    // ... (safety check code remains the same)
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>No simulation data found</h2>
        <p>Play through a scenario before viewing the report.</p>
        <button
          onClick={() =>
            navigate("/simulation", { state: { scenarioId, flowData } })
          }
        >
          ← Back to Simulation
        </button>
      </div>
    );
  }

  // --- Radar Chart Configuration (for hidden chart) ---
  const radarChartOptions = { 
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true }, 
      title: {
        display: true,
        text: 'Psychological Dimension Profile',
        font: { size: 16 }
      },
    },
    scales: {
      r: {
        angleLines: { display: true },
        suggestedMin: 0,
        suggestedMax: 100, // Scores are 0-100
        pointLabels: {
          font: { size: 12 },
        },
        grid: { circular: true },
        ticks: {
          backdropColor: 'white',
          beginAtZero: true,
          max: 100,
          min: 0,
          stepSize: 20
        }
      },
    },
  };

  const radarData = { 
    labels: radarLabels, // Use the 4 dimensions
    datasets: [
      {
        label: "Your Profile (% of Choices)",
        data: radarScores, // Use the calculated 0-100 scores
        backgroundColor: "rgba(54, 162, 235, 0.4)",
        borderColor: "rgba(54, 162, 235, 1)",
        pointBackgroundColor: "rgba(54, 162, 235, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 2,
        fill: true,
      },
    ],
  };


  // --- PDF generation (Updated) ---
  const generatePDFReport = async () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Psychological Profile Report", 14, 22);

    // Capture Radar Chart for PDF
    const radarChartElement = document.getElementById("radar-for-pdf");
    if (radarChartElement) {
      try {
        const canvas = await html2canvas(radarChartElement, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = 180; // Standard A4 width minus margins
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Add chart and title
        doc.setFontSize(16);
        doc.text("Psychological Dimension Profile", 14, 30);
        doc.addImage(imgData, "PNG", 14, 35, imgWidth, imgHeight);
        
        // Calculate Y position for next section
        let yPos = 35 + imgHeight + 10;

        // --- Summary Section ---
        doc.setFontSize(14);
        doc.text("Your Psychological Archetype", 14, yPos);
        yPos += 7;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(archetype, 14, yPos);
        yPos += 7;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        const summaryLines = doc.splitTextToSize(summary, 180); // 180mm width
        doc.text(summaryLines, 14, yPos);
        yPos += (summaryLines.length * 7) + 10; // Update yPos for next section

        // --- Statistics by Dimension ---
        doc.setFontSize(14);
        doc.text("Dimension Analysis", 14, yPos);
        yPos += 5;
        
        const tableHead = [["Psychological Dimension", "Times Chosen", "Avg. Time (s)"]];
        const tableBody = radarLabels.map(dim => { // Use radarLabels to show only the 4
          return [
            dim,
            counts[dim] || 0,
            avgTimes[dim] ? avgTimes[dim].toFixed(2) : '0.00'
          ];
        });

        autoTable(doc, {
          head: tableHead,
          body: tableBody,
          startY: yPos,
          theme: "grid",
        });

        // --- Detailed Choice Log ---
        doc.addPage();
        doc.text("Detailed Choice Analysis", 14, 22);
        
        const choiceTableHead = [["#", "Choice Made", "Dimension", "Time (s)"]];
        const choiceTableBody = data.map((entry, index) => {
          return [
            index + 1,
            entry.choice.length > 50 ? entry.choice.substring(0, 50) + '...' : entry.choice, // Abbreviate
            entry.dimension,
            entry.timeTaken.toFixed(2),
          ];
        });

        autoTable(doc, {
          head: choiceTableHead,
          body: choiceTableBody,
          startY: 30,
          theme: "grid",
        });
      
        doc.save("Scenario_Report.pdf");
        alert("Report saved successfully!");

      } catch (err) {
        console.error("Failed to generate PDF:", err);
        alert("An error occurred while generating the PDF.");
      }
    } else {
      console.warn("Radar chart element for PDF not found!");
    }
  };

  return (
    <div style={{ display: "flex" }}>
      <StudentSidebar />
      <div style={{ flex: 1, padding: "2rem", textAlign: "center" }}>

        {/* --- Hidden Radar Chart for PDF Generation --- */}
        <div
          id="radar-for-pdf"
          style={{
            position: "absolute",
            left: "-9999px",
            top: "-9999px",
            width: "700px", // Define a width
            height: "500px", // Define a height
            backgroundColor: "#ffffff", // Add white background for canvas
            padding: "1rem"
          }}
        >
          <Radar data={radarData} options={radarChartOptions} />
        </div>

        <hr style={{ margin: "2rem auto", maxWidth: "700px" }} />

        <div className="summary-list" style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '700px', margin: 'auto' }}>
            <h2>Summary of Choices</h2>
            <ul style={{ textAlign: "left", maxWidth: "700px", margin: "auto" }}>
            {data.map((entry, i) => (
                <li key={i} style={{margin: '0.5rem 0'}}>
                <strong>Choice {i + 1}:</strong> {entry.choice}{" "}
                <em>({entry.timeTaken.toFixed(1)}s)</em>
                <br />
                <small style={{ color: '#555' }}> (Dimension: {entry.dimension})</small>
                </li>
            ))}
            </ul>
        </div>

        {/* FIX: Corrected the typo below from "7Example.jsx" to "700px" */}
        <hr style={{ margin: "2rem auto", maxWidth: "700px" }} />

        <h2>Full Psychological Profile</h2>
        <p>Download a detailed PDF version of your analysis.</p>
        <button
          onClick={generatePDFReport}
          style={{
            fontSize: "1.1rem",
            padding: "0.8rem 1.5rem",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            width: "200px",
          }}
        >
          Download PDF 📄
        </button>

        <div style={{ marginTop: "2rem" }}>
          {/* Restart button would go here if needed, but it's not in your provided code */}
        </div>
      </div>
    </div>
  );
};

export default ReportInterface;