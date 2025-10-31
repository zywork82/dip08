  import React, { useState, useEffect } from "react";
  import { useLocation, useNavigate } from "react-router-dom";
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
  import SharedHeader from "../components/SharedHeader";
  import NavigationBar from "../components/SlimNavBar";
  import dagre from "dagre";
  import { convertBackendToFrontend, convertFrontendToBackend } from "../utils/flowConverter";

  // Node types
  const nodeTypesConfig = {
    scenario: NodeWrapper,
    option: NodeWrapper,
    ending: NodeWrapper,
  };

  // Dagre layout config
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const nodeWidth = 200;
  const nodeHeight = 150;

  const standardizeNodeData = (node) => {
    const data_description =
      typeof node.data === "string"
        ? node.data
        : node.data?.data_description || node.data?.label || "";

    return {
      ...node,
      data: {
        data_description,
        options: node.options || node.data?.options || [],
        next: node.next || node.data?.next || null,
        scene: node.scene || node.data?.scene || "",
        b64image: node.b64image || node.data?.b64image || "",
        generatedImages: node.data?.generatedImages || [],
        imageUrl: node.data?.imageUrl || null,
        loadingImages: false,
        ...(typeof node.data === "object" ? node.data : {}),
      },
    };
  };


  const getLayoutedNodes = (nodes, edges) => {
    dagreGraph.setGraph({ rankdir: "TB", ranksep: 250, nodesep: 300 });
    nodes.forEach((node) =>
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    );
    edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
    dagre.layout(dagreGraph);
    return nodes.map((node) => {
      const layoutNode = dagreGraph.node(node.id);
      return layoutNode
        ? {
            ...node,
            position: {
              x: layoutNode.x - nodeWidth / 2,
              y: layoutNode.y - nodeHeight / 2,
            },
          }
        : node;
    });
  };

  // ===== Backend Image Generation =====
  const generateImagesFromBackend = async (nodeId, prompt) => {
    try {
      const res = await fetch("http://127.0.0.1:5000/generate_images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmp: true,
          nodes: [{ id: nodeId, data_description: prompt }],
        }),
      });
      if (!res.ok) return { images: [] };
      const data = await res.json();
      return {
        images: data.images?.map((i) => `data:image/png;base64,${i.image_b64}`) || [],
      };
    } catch (err) {
      console.error("Error calling backend:", err);
      return { images: [] };
    }
  };

  const SceneEditor = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const passedFlow = location.state?.flowData;

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [promptText, setPromptText] = useState("");

    // Regenerate images for a node
  const handleReprompt = async (nodeId, prompt) => {
    try {
      const data = await generateImagesFromBackend(nodeId, prompt);
      if (!data.images.length) throw new Error("No images returned");

      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, generatedImages: data.images, imageUrl: data.images[0] || "" } }
            : n
        )
      );
    } catch (err) {
      console.error("Error generating images:", err);
      alert("Image generation failed. Check backend logs.");
    }
  };


    // Select image
    const selectImageForNode = (nodeId, imgUrl) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, imageUrl: imgUrl } } : n))
      );
    };

    // Auto-generate images for all nodes asynchronously
  const autoGenerateImagesForAll = async (nodesList) => {
    for (const node of nodesList) {
      // Skip if images already exist
      if (node.data.generatedImages?.length > 0) continue;

      // Mark as loading
      setNodes(prev =>
        prev.map(n =>
          n.id === node.id ? { ...n, data: { ...n.data, loadingImages: true } } : n
        )
      );

      const data = await generateImagesFromBackend(node.id, node.data.data_description);

      // Merge results safely
      setNodes(prev =>
        prev.map(n =>
          n.id === node.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  generatedImages: data.images,
                  imageUrl: data.images[0] || "",
                  loadingImages: false,
                },
              }
            : n
        )
      );
    }
  };


    const onNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));

    const onNodeClick = (_, node) => {
      setSelectedNode(node);
      setPromptText(node.data.data_description || "");
    };

    // Initialize flow
    useEffect(() => {
      let flowData = passedFlow || JSON.parse(localStorage.getItem("latestFlow"));
      if (!flowData) return;

      if (!flowData.nodes) {
        const frontendFlow = convertBackendToFrontend(flowData);
        flowData = { nodes: Object.values(frontendFlow), edges: [] };
      }

      const standardizedNodes = flowData.nodes.map(standardizeNodeData);
      const layouted = getLayoutedNodes(standardizedNodes, flowData.edges || []);
      setEdges(flowData.edges || []);
      setNodes(layouted);

      autoGenerateImagesForAll(layouted); // async per node
    }, [passedFlow]);

    // Save & Play
    const handleSaveAndPlay = () => {
      const cleanNodes = nodes.map((n) => ({
        ...n,
        data: {
          data_description: n.data.data_description || "Untitled",
          imageUrl: n.data.imageUrl,
          generatedImages: n.data.generatedImages || [],
          options: n.data.options || [],
          next: n.data.next || null,
        },
        position: undefined,
        width: undefined,
        height: undefined,
      }));

      const flowToPlayFrontend = { startNodeId: cleanNodes[0].id, nodes: cleanNodes, edges };

      const flowToSaveBackend = convertFrontendToBackend(
        cleanNodes.reduce((acc, node) => {
          acc[node.id] = node;
          return acc;
        }, {})
      );

      localStorage.setItem("latestFlow", JSON.stringify(flowToSaveBackend));

      const newScenario = {
        id: Date.now(),
        title: selectedNode?.data.label || "Untitled Scenario",
        description: promptText || "",
        flowData: flowToSaveBackend,
        createdAt: new Date().toISOString(),
      };

      const existing = JSON.parse(localStorage.getItem("scenarios") || "[]");
      existing.push(newScenario);
      localStorage.setItem("scenarios", JSON.stringify(existing));

      navigate("/scenarioInterface", { state: { flowData: flowToPlayFrontend } });
    };

    const profileImage = "https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A";

    return (
      <div className="scene-editor-container">
        <NavigationBar />
        <div className="editor-container">
          <div className="header">
            <SharedHeader profileImage={profileImage} userName="Prof Andy" userRole="Administrator" />
          </div>

          <div className="scene-editor-content">
            <div className="node-sidebar">
              {selectedNode ? (
                <>
                  <h3>{selectedNode.data.label || "Untitled"}</h3>
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
    disabled={selectedNode.data.loadingImages}
  >
    {selectedNode.data.loadingImages ? "Generating..." : "Generate Images"}
  </button>

                  <div className="image-grid">
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

                  <button style={{ width: "100%", marginTop: 10 }} onClick={handleSaveAndPlay}>
                    💾 Save & Play Story
                  </button>
                </>
              ) : (
                <div style={{ color: "#888", fontStyle: "italic" }}>Click a node to view details and generate images</div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypesConfig}
                  fitView
                  onNodeClick={onNodeClick}
                  onNodesChange={onNodesChange}
                  nodesDraggable
                  zoomOnScroll
                  panOnDrag
                  zoomOnPinch
                  defaultEdgeOptions={{
                    animated: true,
                    type: "smoothstep",
                    style: { stroke: "#333", strokeWidth: 4 },
                  }}
                >
                  <MiniMap />
                  <Controls />
                  <Background />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          </div>
        </div>
      </div>
    );
  };

  export default SceneEditor;
