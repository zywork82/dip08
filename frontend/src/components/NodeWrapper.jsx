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
  }, [data.data_description]); // watch data_description instead of label

  const handleChange = (e) => {
    if (data.onChange) data.onChange(e); // pass the event to update React Flow state
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

      {(data.b64image || data.imageUrl) && (
        <img
          src={data.imageUrl || data.b64image}
          alt={data.data_description || "Untitled"}
          style={{
            width: "100%",
            maxHeight: 120,
            objectFit: "cover",
            marginBottom: 5,
            borderRadius: 5,
          }}
        />
      )}

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
