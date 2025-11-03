/**
 * Converts backend flow format → frontend ReactFlow format
 * for SceneEditor & ScenarioInterface.
 */
export function convertBackendToFrontend(backendFlow) {
  return Object.entries(backendFlow).reduce((acc, [id, node]) => {
    acc[id] = {
      id: node.id,
      type: node.type || "scenario",
      position: node.position || { x: 0, y: 0 },
      data: {
        data_description:
          node.data?.data_description || node.data || "",
        options: node.data?.options || node.options || [],
        next: node.data?.next || node.next || null,
        scene: node.data?.scene || node.scene || "",
        b64image: node.data?.b64image || node["b64 image"] || "",
        imageUrl:
          node.data?.imageUrl ||
          (node.data?.b64image
            ? `data:image/png;base64,${node.data.b64image}`
            : ""),
        generatedImages: node.data?.generatedImages || [],
        loadingImages: false,
      },
    };
    return acc;
  }, {});
}

/**
 * Converts frontend ReactFlow nodes → backend format
 * for saving to database or API.
 * ✅ Always returns an array, not object.
 */
export function convertFrontendToBackend(frontendFlow) {
  // frontendFlow is an object like { "101": { ... }, "101A": { ... } }
  return Object.values(frontendFlow).map((node) => ({
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
  return nodes.map((n) => ({
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
  }));
}
