import React from "react";
import { Radar } from "react-chartjs-2";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

const TraineeReportModal = ({ trainee, onClose }) => {
  if (!trainee) return null;

  const { choices = [], scenario_id, user_id } = trainee;

  // Generate radar chart data
  const radarLabels = ["Bias", "Risk", "Orientation", "Critical Thinking"];
  const radarScores = choices.length
    ? [
        ((choices.reduce((a, c) => a + (c.scores?.bias_confirmation || 0) + (c.scores?.bias_confidence || 0), 0) / (choices.length * 2) + 1) * 50),
        ((choices.reduce((a, c) => a + (c.scores?.risk_tolerance || 0), 0) / choices.length + 1) * 50),
        ((choices.reduce((a, c) => a + (c.scores?.time_vs_relationship || 0), 0) / choices.length + 1) * 50),
        ((choices.reduce((a, c) => a + (c.scores?.thinking_disposition || 0), 0) / choices.length + 1) * 50),
      ]
    : [0, 0, 0, 0];

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

  // Profile summary
  const descriptions = [
    `Bias Profile: ${radarScores[0] > 60 ? "Leans toward bias" : radarScores[0] < 40 ? "Reflective" : "Balanced"}`,
    `Risk Tolerance: ${radarScores[1] > 60 ? "Risk-seeking" : radarScores[1] < 40 ? "Risk-averse" : "Calculated"}`,
    `Orientation: ${radarScores[2] > 60 ? "Efficiency-driven" : radarScores[2] < 40 ? "Relationship-driven" : "Balanced"}`,
    `Thinking Disposition: ${radarScores[3] > 60 ? "Analytical" : radarScores[3] < 40 ? "Intuitive" : "Balanced"}`,
  ];

  const avgTime =
    choices.length > 0
      ? choices.reduce((a, c) => a + (c.timeTaken || 0), 0) / choices.length
      : 0;

  // PDF download
  const downloadPDF = async () => {
    const modalElement = document.getElementById("radar-for-pdf");
    if (!modalElement) return alert("Chart missing");

    const canvas = await html2canvas(modalElement, { scale: 2 });
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
    const tableBody = choices.map((entry) => {
      const scores = entry.scores || {};
      return [
        entry.choice || "-",
        (entry.timeTaken || 0).toFixed(2),
        scores.bias_confirmation > 0 ? "Bias Leaning" : scores.bias_confirmation < 0 ? "Reflective" : "Neutral",
        scores.risk_tolerance > 0 ? "Risk-Seeking" : scores.risk_tolerance < 0 ? "Risk-Averse" : "Neutral",
        scores.time_vs_relationship > 0 ? "Efficiency-Driven" : scores.time_vs_relationship < 0 ? "Relationship-Driven" : "Neutral",
        scores.thinking_disposition > 0 ? "Analytical" : scores.thinking_disposition < 0 ? "Intuitive" : "Neutral",
      ];
    });
    autoTable(doc, {
      head: [["Choice", "Time (s)", "Bias", "Risk", "Orientation", "Thinking"]],
      body: tableBody,
      startY: 30,
      theme: "grid",
    });

    doc.save("Scenario_Report.pdf");
    alert("Report saved!");
  };

  return (
     <div
      onClick={onClose} // 👈 clicking on the overlay triggers close
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()} // 👈 prevents clicks inside modal from closing it
        style={{
          position: "relative",
          backgroundColor: "#fff",
          borderRadius: "10px",
          width: "100%",
          maxWidth: "700px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            fontSize: "1.5rem",
            border: "none",
            background: "none",
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "2rem 1rem 1rem 1rem" }}>
          <h2 style={{ textAlign: "center" }}>Scenario Report</h2>

          <div id="radar-for-pdf" style={{ width: "100%", maxWidth: "400px", margin: "1rem auto" }}>
            <Radar data={radarData} />
          </div>

          <h3>Profile Summary</h3>
          <p>Average Decision Time: {avgTime.toFixed(2)}s</p>
          <ul>
            {descriptions.map((desc, i) => (
              <li key={i}>{desc}</li>
            ))}
          </ul>

          <h3>Detailed Choice Analysis</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: "4px" }}>Choice</th>
                <th style={{ border: "1px solid #ccc", padding: "4px" }}>Time (s)</th>
                <th style={{ border: "1px solid #ccc", padding: "4px" }}>Bias</th>
                <th style={{ border: "1px solid #ccc", padding: "4px" }}>Risk</th>
                <th style={{ border: "1px solid #ccc", padding: "4px" }}>Orientation</th>
                <th style={{ border: "1px solid #ccc", padding: "4px" }}>Thinking</th>
              </tr>
            </thead>
            <tbody>
              {choices.map((entry, i) => {
                const scores = entry.scores || {};
                return (
                  <tr key={i}>
                    <td style={{ border: "1px solid #ccc", padding: "4px" }}>{entry.choice}</td>
                    <td style={{ border: "1px solid #ccc", padding: "4px" }}>{(entry.timeTaken || 0).toFixed(2)}</td>
                    <td style={{ border: "1px solid #ccc", padding: "4px" }}>
                      {scores.bias_confirmation > 0 ? "Bias Leaning" : scores.bias_confirmation < 0 ? "Reflective" : "Neutral"}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "4px" }}>
                      {scores.risk_tolerance > 0 ? "Risk-Seeking" : scores.risk_tolerance < 0 ? "Risk-Averse" : "Neutral"}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "4px" }}>
                      {scores.time_vs_relationship > 0 ? "Efficiency-Driven" : scores.time_vs_relationship < 0 ? "Relationship-Driven" : "Neutral"}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "4px" }}>
                      {scores.thinking_disposition > 0 ? "Analytical" : scores.thinking_disposition < 0 ? "Intuitive" : "Neutral"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            onClick={downloadPDF}
            style={{
              marginTop: "1rem",
              padding: "0.8rem 1.5rem",
              fontSize: "1rem",
              cursor: "pointer",
              borderRadius: "5px",
              border: "none",
              backgroundColor: "#007bff",
              color: "white",
            }}
          >
            Download PDF 📄
          </button>
        </div>
      </div>
    </div>
  );
};

export default TraineeReportModal;
