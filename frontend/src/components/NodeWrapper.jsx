import { useEffect, useRef } from "react";
import { Handle, Position } from "reactflow";
//import "../styles/SceneEditor.css"; // ensure styles for .node and .selected
import "../styles/FlowChartEditor.css"; // ensure styles for .node and .selected

const NodeWrapper = ({ id, data, selected, type }) => {
  const textareaRef = useRef(null);

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  };

  useEffect(() => {
    resizeTextarea();
  }, [data.label]);

  const handleChange = (e) => {
    if (data.onReprompt) data.onReprompt(e.target.value);
    resizeTextarea();
  };

  return (
    <div className={`node node-${type} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
{selected && data.onDelete && (
  <button
    onClick={data.onDelete}
    style={{
      position: "absolute",
      top: 4,
      right: 4,
      width: 10,
      height: 10,
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

      {data.imageUrl && (
        <img
          src={data.imageUrl}
          alt={data.label}
          style={{ width: "100%", marginBottom: 5, borderRadius: 5 }}
        />
      )}

      <textarea
        ref={textareaRef}
        value={data.label}
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
