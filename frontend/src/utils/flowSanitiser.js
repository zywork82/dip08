export const sanitizeFlowForNavigation = (flowData) => {
  if (!flowData) return { nodes: [], edges: [] };

  const safeNodes = (flowData.nodes || []).map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      data_description: n.data?.data_description || "",
      options: n.data?.options || [],
      next: n.data?.next || null,

      // ✅ Preserve existing image data if present
      b64image: n.data?.b64image || "",
      imageUrl: n.data?.imageUrl || "",
      generatedImages: n.data?.generatedImages || [],
    },
  }));

  const safeEdges = (flowData.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type || "smoothstep",
  }));

  return { nodes: safeNodes, edges: safeEdges };
};
