
/**
 * Converts backend flow format → frontend ReactFlow format
 * for SceneEditor & ScenarioInterface.
 */
export function convertBackendToFrontend(backendFlow) {
  // Normalize the incoming data
  const nodesArray = Array.isArray(backendFlow)
    ? backendFlow
    : backendFlow?.nodes
    ? backendFlow.nodes
    : Object.values(backendFlow || {});

  if (!Array.isArray(nodesArray)) {
    console.warn("⚠️ Invalid backendFlow format:", backendFlow);
    return [];
  }

  return nodesArray
    .filter((node) => node && typeof node === "object") // ✅ skip nulls
    .map((node, i) => {
      const safeData = node.data || {}; // ✅ fallback to empty object

      const b64image = safeData.b64image || node["b64 image"] || "";
      const imageUrl =
        safeData.imageUrl?.startsWith("http")
          ? safeData.imageUrl
          : b64image
          ? `data:image/png;base64,${b64image}`
          : safeData.imageUrl || "";

      return {
        id: node.id || `unknown-${i}`,
        type: node.type || "scenario",
        position: node.position || { x: 0, y: 0 },
        data: {
          data_description:
            typeof safeData.data_description === "string"
              ? safeData.data_description
              : "",
          options: safeData.options || node.options || [],
          next: safeData.next || node.next || null,
          scene: safeData.scene || node.scene || "",
          b64image,
          imageUrl,
          generatedImages: safeData.generatedImages || [],
          loadingImages: false,
        },
      };
    });
}


/**
 * Converts frontend ReactFlow nodes → backend format
 * for saving to database or API.
 * ✅ Always returns an array, not object.
 */
export function convertFrontendToBackend(frontendFlow) {
  const nodesArray = Array.isArray(frontendFlow)
    ? frontendFlow
    : Object.values(frontendFlow);

  return nodesArray.map((node) => ({
    id: node.id,
    type: node.type || "scenario",
    position: node.position || { x: 0, y: 0 },
    data: {
      data_description: node.data?.data_description || "",
      options: node.data?.options || [],
      next: node.data?.next || null,
      scene: node.data?.scene || "",
      b64image: node.data?.b64image || "",
      imageUrl: node.data?.imageUrl || "",
      generatedImages: node.data?.generatedImages || [],
    },
    psych_dimensions: node.psych_dimensions || "",
  }));
}

/**
 * Helper: build a backend flow object from ReactFlow node/edge arrays
 */
export function buildFlowObject(nodes, edges) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type || "scenario",
      position: n.position || { x: 0, y: 0 },
      data: {
        data_description: n.data?.data_description || "",
        options: n.data?.options || [],
        next: n.data?.next || null,
        scene: n.data?.scene || "",
        b64image: n.data?.b64image || "",
        imageUrl: n.data?.imageUrl || "",
        generatedImages: n.data?.generatedImages || [],
      },
    })),
    edges: (edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type || "smoothstep",
    })),
  };
}
