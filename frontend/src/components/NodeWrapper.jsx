import { useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';

const NodeWrapper = ({ id, data, selected, type }) => {
  const textareaRef = useRef(null);

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto'; // reset
    textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
  };

  // Resize whenever text changes
  useEffect(() => {
    resizeTextarea();
  }, [data.label]);

  const handleChange = (e) => {
    data.onChange(e);
    resizeTextarea();
  };

  return (
    <div className={`node node-${type}`}>
      <Handle type="target" position={Position.Top} />
      <textarea
        ref={textareaRef}
        value={data.label}
        onChange={handleChange}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          resize: 'none',
          overflow: 'hidden',
          fontSize: '14px',
          lineHeight: '1.2',
        }}
        rows={1}
      />
      <Handle type="source" position={Position.Bottom} />
      {selected && (
        <button className="node-delete-button" onClick={data.onDelete}>
          ×
        </button>
      )}
    </div>
  );
};

export default NodeWrapper;
