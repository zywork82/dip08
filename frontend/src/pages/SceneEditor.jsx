// SceneEditor.jsx
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import ReactFlow, {
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
} from "reactflow";
import NodeWrapper from "../components/NodeWrapper"; 
import "reactflow/dist/style.css";
import "../styles/SceneEditor.css";
import dagre from "dagre";

// Node types
const nodeTypesConfig = {
  scenario: NodeWrapper,
  option: NodeWrapper,
  popup: NodeWrapper,
  ending: NodeWrapper,
};

// Dagre layout
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 200;
const nodeHeight = 150;

const getLayoutedNodes = (nodes, edges) => {
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 100 });
  nodes.forEach((node) =>
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  );
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  return nodes.map((node) => {
    const { x, y } = dagreGraph.node(node.id);
    return { ...node, position: { x: x - nodeWidth / 2, y: y - nodeHeight / 2 } };
  });
};

const SceneEditor = () => {
  const location = useLocation();
  const flowData = location.state?.flowData;

  const [nodes, setNodes] = useState(flowData?.nodes || []);
  const [edges, setEdges] = useState(flowData?.edges || []);
  const [selectedNode, setSelectedNode] = useState(null);
  const [promptText, setPromptText] = useState("");

  // --- Mock backend function ---
  const mockGenerateImages = (nodeId, prompt) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const images = Array.from({ length: 3 }, () =>
          `https://picsum.photos/200/150?random=${Math.floor(Math.random() * 1000)}`
        );
        resolve({ images });
      }, 500);
    });
  };

  const handleReprompt = (nodeId, prompt) => {
    mockGenerateImages(nodeId, prompt).then((data) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: { ...n.data, generatedImages: data.images, imageUrl: data.images[0] },
              }
            : n
        )
      );
    });
  };

  const selectImageForNode = (nodeId, imgUrl) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, imageUrl: imgUrl } } : n))
    );
  };

  // Track selection
  const onNodeClick = (_, node) => {
    setSelectedNode(node);
    setPromptText(node.data.label);
  };

  // Attach onReprompt handler only once
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, onReprompt: (p) => handleReprompt(n.id, p) },
      }))
    );
  }, []);

  // Apply auto-layout once
  useEffect(() => {
    if (nodes.length && edges.length) {
      const layouted = getLayoutedNodes(nodes, edges);
      setNodes(layouted);
    }
  }, [nodes.length, edges.length]);

  const onNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));
 // Initialize nodes with pre-generated images
  useEffect(() => {
    if (!flowData) return;

    const initNodes = flowData.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        generatedImages: [],
        imageUrl: null,
      },
    }));

    setEdges(flowData.edges);

    // Apply auto-layout immediately
    setNodes(getLayoutedNodes(initNodes, flowData.edges));

    // Pre-generate images for all nodes
    initNodes.forEach((node) => {
      mockGenerateImages(node.id, node.data.label).then((data) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === node.id
              ? { ...n, data: { ...n.data, generatedImages: data.images, imageUrl: data.images[0] } }
              : n
          )
        );
      });
    });
  }, [flowData]);
  return (
    <div className="scene-editor-container" style={{ display: "flex", width: "100%", height: "100vh" }}>
      {/* Sidebar */}
      {selectedNode && (
        <div
          className="node-sidebar"
          style={{
            width: 300,
            padding: 20,
            background: "#f5f5f5",
            borderRight: "1px solid #ccc",
            overflowY: "auto",
          }}
        >
          <h3>{selectedNode.data.label}</h3>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Refine prompt or add description"
            rows={4}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <button
            style={{ width: "100%", marginBottom: 10 }}
            onClick={() => handleReprompt(selectedNode.id, promptText)}
          >
            Generate Images
          </button>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {selectedNode.data.generatedImages?.map((imgUrl, index) => (
              <img
                key={index}
                src={imgUrl}
                alt={`Option ${index}`}
                style={{
                  width: 100,
                  marginRight: 5,
                  marginBottom: 5,
                  cursor: "pointer",
                  border: imgUrl === selectedNode.data.imageUrl ? "2px solid blue" : "1px solid gray",
                }}
                onClick={() => selectImageForNode(selectedNode.id, imgUrl)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main editor */}
      <div style={{ flex: 1 }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypesConfig}
            fitView
            onNodeClick={onNodeClick}
            onNodesChange={onNodesChange}
            nodesDraggable={true}
            zoomOnScroll={true}
            panOnDrag={true}
            zoomOnPinch={true}
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default SceneEditor;
