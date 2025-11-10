export function normalizeFlow(flowData) {
  if (!flowData) return { nodes: [], edges: [] };

  // --- Normalize node array ---
  let nodesRaw = [];
  if (Array.isArray(flowData.nodes)) nodesRaw = flowData.nodes;
  else if (flowData.nodes && typeof flowData.nodes === "object")
    nodesRaw = Object.values(flowData.nodes);
  else if (typeof flowData === "object" && !Array.isArray(flowData))
    nodesRaw = Object.values(flowData);

  const nodes = nodesRaw
    .filter((n) => n && typeof n === "object" && n.id)
    .map((n) => ({
      id: String(n.id),
      type: n.type || "scenario",
      position: n.position || { x: 0, y: 0 },
      data: {
        data_description: n.data?.data_description || n.data_description || "",
        options: n.data?.options || n.options || [],
        next: n.data?.next || n.next || null,
        scene: n.data?.scene || n.scene || "",
        imageUrl: n.data?.imageUrl || "",
        b64image: n.data?.b64image || "",
        generatedImages: n.data?.generatedImages || [],
      },
    }));

  // --- Normalize edges ---
  const edges =
    Array.isArray(flowData.edges)
      ? flowData.edges.filter((e) => e.source && e.target)
      : [];

  return {
    id: flowData.id || flowData._id || null,
    title: flowData.title || "Untitled Scenario",
    nodes,
    edges,
    startNodeId: flowData.startNodeId || nodes[0]?.id || null,
    status: flowData.status || "Draft",
  };
}
