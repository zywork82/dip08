import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../styles/AnalyticsEngine.css";

// Fake student data
const studentData = [
  { questionId: "1A", selectedOption: "A", timeTaken_sec: 5 },
  { questionId: "2B", selectedOption: "C", timeTaken_sec: 8 },
  { questionId: "3A", selectedOption: "B", timeTaken_sec: 3 },
  { questionId: "3B", selectedOption: "D", timeTaken_sec: 6 },
  { questionId: "4A", selectedOption: "A", timeTaken_sec: 5 },
  { questionId: "5B", selectedOption: "C", timeTaken_sec: 8 },
  { questionId: "5C", selectedOption: "B", timeTaken_sec: 7 },
  { questionId: "6A", selectedOption: "D", timeTaken_sec: 4 },
];

// Fake student profile (can fetch from backend later)
const studentProfile = {
  name: "John Doe",
  ID: "U1234567A",
};

const AnalyticsEngine = () => {
  const [studentDataLive, setStudentDataLive] = useState(studentData);

  // Data for chart
  const decisionVsTime = studentDataLive.map((d, i) => ({
    index: i + 1,
    question: d.questionId,
    option: d.selectedOption,
    time: d.timeTaken_sec,
  }));

  // ====== Export functions ======
  const exportToCSV = () => {
    const headers = ["Question", "Option", "Time Taken (s)"];
    const rows = studentDataLive.map((d) => [d.questionId, d.selectedOption, d.timeTaken_sec]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Student Report", 14, 20);

    // ===== Student Profile =====
    doc.setFontSize(14);
    doc.text("Student Profile", 14, 30);
    const profileData = [
      ["Name", studentProfile.name],
      ["ID", studentProfile.ID],
    ];
    autoTable(doc, { startY: 35, body: profileData, styles: { fontSize: 12 } });

    // ===== Raw Data Table =====
    const tableColumn = ["Question", "Option", "Time Taken (s)"];
    const tableRows = studentDataLive.map((d) => [d.questionId, d.selectedOption, d.timeTaken_sec]);
    autoTable(doc, {
      startY: 75,
      head: [tableColumn],
      body: tableRows,
      styles: { fontSize: 12 },
    });

    doc.save("student_report.pdf");
  };

  return (
    <div className="analytics-dashboard">
      <h1 className="dashboard-title">Student Analytics Engine</h1>

      {/* ====== Export Buttons ====== */}
      <div className="analytics-buttons">
        <button className="btn-csv" onClick={exportToCSV}>
          Download CSV
        </button>
        <button className="btn-pdf" onClick={exportToPDF}>
          Download PDF
        </button>
      </div>

      {/* ====== Decision vs Time Taken Chart ====== */}
      <div className="bg-white p-4 rounded-2xl shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          Decision vs Time Taken
        </h2>
        <ResponsiveContainer width={1000} height={400}>
          <LineChart data={decisionVsTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="question"
              label={{
                value: "Questions",
                position: "insideBottom",
                offset: -5,
              }}
            />
            <YAxis
              label={{ value: "Time (s)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(val, name, props) => [
                `${val}s`,
                `Option: ${props.payload.option}`,
              ]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="time"
              stroke="#4f46e5"
              strokeWidth={2}
              dot
            >
              <LabelList dataKey="option" position="top" />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalyticsEngine;
