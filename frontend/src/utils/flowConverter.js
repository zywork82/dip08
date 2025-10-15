// src/utils/flowConverter.js

/**
 * Converts backend flow format → frontend ReactFlow format
 * so the editor can display it properly.
 */
export function convertBackendToFrontend(backendFlow) {
  return Object.entries(backendFlow).reduce((acc, [id, node]) => {
    acc[id] = {
      id: node.id,
      type: node.type,
      position: node.position && node.position.x !== undefined
        ? node.position
        : { x: 0, y: 0 },
      data: { label: node.data || "" },
      scene: node.scene || "",
      options: node.options || [],
      psych_dimensions: node.psych_dimensions || "",
      b64image: node["b64 image"] || node.b64image || "",
    };
    return acc;
  }, {});
}

/**
 * Converts frontend ReactFlow format → backend flow format
 * for saving or sending to API.
 */
export function convertFrontendToBackend(frontendFlow) {
  return Object.entries(frontendFlow).reduce((acc, [id, node]) => {
    acc[id] = {
      id: node.id,
      type: node.type,
      position: node.position || { x: 0, y: 0 },
      data: node.data?.label || "",
      scene: node.scene || "",
      options: node.options || [],
      psych_dimensions: node.psych_dimensions || "",
      "b64 image": node.b64image || "",
    };
    return acc;
  }, {});
}

/**
 * Optional: Helper to convert ReactFlow node/edge arrays
 * into an object-based format (like backend expects).
 */
export function buildFlowObject(nodes, edges) {
  const flow = {};
  nodes.forEach((n) => {
    flow[n.id] = {
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data?.label || "",
      scene: n.scene || "",
      options: n.options || [],
      psych_dimensions: n.psych_dimensions || "",
      "b64 image": n.b64image || "",
    };
  });
  return flow;
}
