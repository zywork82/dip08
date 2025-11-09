import React from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
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
  Title,
  Tooltip,
  Legend
);

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
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Seconds" } },
      },
    },
  };
};

// ========== Helper 2: Psychological analysis ==========
const calculateProfileData = (data = []) => {
  if (!data.length)
    return { descriptions: [], avgTime: 0, labels: [], scores: [] };

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgTime = avg(data.map((e) => e.timeTaken || 0));
  const avgBiasConfirmation = avg(data.map((e) => e.scores.bias_confirmation || 0));
  const avgBiasConfidence = avg(data.map((e) => e.scores.bias_confidence || 0));
  const avgRiskTolerance = avg(data.map((e) => e.scores.risk_tolerance || 0));
  const avgTimeVsRelationship = avg(data.map((e) => e.scores.time_vs_relationship || 0));
  const avgThinkingDisposition = avg(data.map((e) => e.scores.thinking_disposition || 0));

  const biasScore = ((avgBiasConfirmation + avgBiasConfidence) / 2 + 1) * 50;
  const riskScore = (avgRiskTolerance + 1) * 50;
  const orientationScore = (avgTimeVsRelationship + 1) * 50;
  const thinkingScore = (avgThinkingDisposition + 1) * 50;

  const descriptions = [
    `Bias Profile: ${biasScore > 60 ? "Leans toward bias." : biasScore < 40 ? "Reflective." : "Balanced."}`,
    `Risk Tolerance: ${riskScore > 60 ? "Risk-seeking" : riskScore < 40 ? "Risk-averse" : "Calculated"}.`,
    `Orientation: ${orientationScore > 60 ? "Efficiency-driven" : orientationScore < 40 ? "Relationship-driven" : "Balanced"}.`,
    `Thinking Disposition: ${thinkingScore > 60 ? "Analytical" : thinkingScore < 40 ? "Intuitive" : "Balanced"}.`,
  ];

  return {
    descriptions,
    avgTime,
    labels: ["Bias", "Risk", "Orientation", "Critical Thinking"],
    scores: [biasScore, riskScore, orientationScore, thinkingScore],
  };
};

// ========== Helper 3: Score text for table ==========
const getScoreDescriptions = (scores = {}) => {
  const bias =
    (scores.bias_confirmation || 0) + (scores.bias_confidence || 0);
  return {
    bias: bias > 0 ? "Bias Leaning" : bias < 0 ? "Reflective" : "Neutral",
    risk:
      (scores.risk_tolerance || 0) > 0
        ? "Risk-Seeking"
        : (scores.risk_tolerance || 0) < 0
        ? "Risk-Averse"
        : "Neutral",
    orientation:
      (scores.time_vs_relationship || 0) > 0
        ? "Efficiency-Driven"
        : (scores.time_vs_relationship || 0) < 0
        ? "Relationship-Driven"
        : "Neutral",
    thinking:
      (scores.thinking_disposition || 0) > 0
        ? "Analytical"
        : (scores.thinking_disposition || 0) < 0
        ? "Intuitive"
        : "Neutral",
  };
};

// ========== Main Component ==========
const ReportInterface = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { scenarioId, choicesLog = [], flowData } = location.state || {};

  useEffect(() => {
  const autoSaveReport = async () => {
    const totalScore = radarScores.reduce((a, b) => a + b, 0) / radarScores.length;

    await saveReportToDB({
      user_id: "test_user",             // 🔁 Replace with actual user ID
      scenario_id: scenarioId || "unknown_scenario",
      score: totalScore.toFixed(2),
      choices: data.map((entry) => ({
        choice: entry.choice,
        timeTaken: entry.timeTaken,
        scores: entry.scores,
      })),
      time_taken: avgTime,
    });
  };

  if (data.length) {
    autoSaveReport(); // save automatically when report page loads
  }
}, []); // empty dependency array → runs once on mount

  // 🩹 Safety: if user comes here with no data
  if (!choicesLog.length) {
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

  // Generate synthetic display data for the report
  const data = choicesLog.map((c, i) => ({
    choice:
      flowData?.nodes?.find((n) => n.id === c.optionId)?.data
        ?.data_description || `Option ${c.optionId}`,
    timeTaken: c.timeTaken || 0,
    scores: {
      bias_confirmation: Math.random() * 2 - 1,
      bias_confidence: Math.random() * 2 - 1,
      risk_tolerance: Math.random() * 2 - 1,
      time_vs_relationship: Math.random() * 2 - 1,
      thinking_disposition: Math.random() * 2 - 1,
    },
  }));

  const { chartData: lineData, chartOptions: lineOptions } =
    prepareLineChartData(data);
  const { descriptions, avgTime, labels: radarLabels, scores: radarScores } =
    calculateProfileData(data);

  // PDF generation
  const generatePDFReport = async () => {
    const chartElement = document.getElementById("radar-for-pdf");
    if (!chartElement) return alert("Chart missing.");
    const canvas = await html2canvas(chartElement, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Psychological Profile Report", 14, 22);
    const imgWidth = 180;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    doc.addImage(imgData, "PNG", 14, 30, imgWidth, imgHeight);

    const summaryY = 30 + imgHeight + 10;
    doc.setFontSize(14);
    doc.text("Profile Summary", 14, summaryY);
    doc.setFontSize(11);
    doc.text(`Average Decision Time: ${avgTime.toFixed(2)}s`, 14, summaryY + 7);
    let y = summaryY + 15;
    descriptions.forEach((desc) => {
      doc.text(`• ${desc}`, 16, y);
      y += 7;
    });

    doc.addPage();
    doc.text("Detailed Choice Analysis", 14, 22);
    const tableBody = data.map((entry) => {
      const scoreText = getScoreDescriptions(entry.scores);
      return [
        entry.choice.slice(0, 40),
        entry.timeTaken.toFixed(2),
        scoreText.bias,
        scoreText.risk,
        scoreText.orientation,
        scoreText.thinking,
      ];
    });
    autoTable(doc, {
      head: [
        ["Choice", "Time (s)", "Bias", "Risk", "Orientation", "Thinking"],
      ],
      body: tableBody,
      startY: 30,
      theme: "grid",
    });
    // 🧠 Save to backend before downloading
    const totalScore = radarScores.reduce((a, b) => a + b, 0) / radarScores.length;

    await saveReportToDB({
      user_id: "test_user", // 🔁 replace with real user ID if you have login/auth
      scenario_id: scenarioId || "unknown_scenario",
      score: totalScore.toFixed(2),
      choices: data.map((entry) => ({
        choice: entry.choice,
        timeTaken: entry.timeTaken,
        scores: entry.scores,
      })),
      time_taken: avgTime,
    });

    doc.save("Scenario_Report.pdf");
  };

  const radarData = {
    labels: radarLabels,
    datasets: [
      {
        label: "Profile",
        data: radarScores,
        backgroundColor: "rgba(54,162,235,0.2)",
        borderColor: "rgba(54,162,235,1)",
      },
    ],
  };

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <div
        id="radar-for-pdf"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: "700px",
        }}
      >
        <Radar data={radarData} />
      </div>

      <h1>Your Report</h1>
      <div style={{ width: "80%", maxWidth: "700px", margin: "auto" }}>
        <Line options={lineOptions} data={lineData} />
      </div>

      <h2 style={{ marginTop: "2rem" }}>Summary of Choices</h2>
      <ul style={{ textAlign: "left", maxWidth: "700px", margin: "auto" }}>
        {data.map((entry, i) => (
          <li key={i}>
            <strong>Choice {i + 1}:</strong> {entry.choice}{" "}
            <em>({entry.timeTaken.toFixed(1)}s)</em>
          </li>
        ))}
      </ul>

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
        }}
      >
        Download PDF 📄
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

export default ReportInterface;
