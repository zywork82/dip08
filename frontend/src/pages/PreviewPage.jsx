import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactFlow, { ReactFlowProvider, MiniMap, Controls, Background } from 'reactflow';
import NodeWrapper from '../components/NodeWrapper';
import 'reactflow/dist/style.css';

const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  popup: NodeWrapper,
  ending: NodeWrapper,
};

const PreviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Add fallback for location.state
  const flowData = location.state?.flowData;

  if (!flowData) {
    return (
      <div style={{ padding: 20 }}>
        <h2>No flow data found</h2>
        <p>
          It seems you accessed this page directly. Go back to the editor to generate a flow first.
        </p>
        <button onClick={() => navigate(-1)}>Back to Editor</button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowData.nodes}
          edges={flowData.edges}
          nodeTypes={nodeTypesConfig}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          nodesDraggable={false}
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
        <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
          <button onClick={() => navigate(-1)}>Back to Editor</button>
        </div>
      </ReactFlowProvider>
    </div>
  );
};

export default PreviewPage;
