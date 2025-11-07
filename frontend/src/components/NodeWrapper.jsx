import { useEffect, useRef } from "react";
import { Handle, Position } from "reactflow";
import "../styles/FlowChartEditor.css";

const NodeWrapper = ({ id, data, selected, type }) => {
  const textareaRef = useRef(null);

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  };

  useEffect(() => {
    resizeTextarea();
  }, [data.data_description]);

  const handleChange = (e) => {
    if (data.onChange) data.onChange(e);
    resizeTextarea();
  };

  return (
    <div
      className={`node node-${type} ${selected ? "selected" : ""}`}
      style={{
        position: "relative",
        borderRadius: "8px",
      }}
    >
      <Handle type="target" position={Position.Top} />

      {/* Delete button (only when selected) */}
      {selected && data.onDelete && (
        <button
          onClick={data.onDelete}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "none",
            background: "red",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold",
            lineHeight: 1,
            zIndex: 10,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          ×
        </button>
      )}

 {/* === Node Image === */}
<div style={{ position: "relative" }}>
  {(data.b64image || data.imageUrl) && (
    <img
      src={
        data.imageUrl?.startsWith("data:image")
          ? data.imageUrl
          : data.b64image
          ? `data:image/png;base64,${data.b64image}`
          : data.imageUrl
      }
      alt={data.data_description || "Untitled"}
      style={{
        width: 300,
        maxHeight: 200,
        objectFit: "cover",
        marginBottom: 5,
        borderRadius: 5,
      }}
    />
  )}

  {/* 🌀 Spinner overlay */}
  {data.loadingImages && (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255, 255, 255, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        borderRadius: 5,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: "3px solid #3f51b5",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      ></div>
      <p
        style={{
          fontSize: 10,
          marginTop: 6,
          color: "#333",
          fontWeight: 500,
        }}
      >
        Generating...
      </p>
    </div>
  )}

  {/* ⚠️ Retry overlay */}
  {data.failedImage && !data.loadingImages && (
    <div
      onClick={() => data.onRetry && data.onRetry(id)}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255, 0, 0, 0.15)",
        color: "red",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        borderRadius: 5,
        cursor: "pointer",
      }}
    >
      🔁 Retry
    </div>
  )}
</div>


      {/* === Description === */}
      <textarea
        ref={textareaRef}
        value={data.data_description || ""}
        onChange={handleChange}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          resize: "none",
          overflow: "hidden",
          fontSize: "14px",
          lineHeight: "1.2",
        }}
        rows={1}
      />

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default NodeWrapper;
