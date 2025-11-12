import dagre from "dagre";

const nodeWidth = 300;
const nodeHeight = 160;

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export function getLayoutedNodes(nodes, edges) {
  dagreGraph.setGraph({
    rankdir: "TB", // Top → Bottom
    ranksep: 200, // vertical gap between levels
    nodesep: 600, // horizontal gap between columns
    ranker: "tight-tree", // 👈 preserves column-per-branch
    marginx: 60,
    marginy: 70,
  });

  // build dagre graph
  nodes.forEach((n) =>
    dagreGraph.setNode(n.id, { width: nodeWidth, height: nodeHeight })
  );
  edges.forEach((e) => dagreGraph.setEdge(e.source, e.target));

  dagre.layout(dagreGraph);

  // apply dagre positions
  let layouted = nodes.map((n) => {
    const pos = dagreGraph.node(n.id);
    if (!pos) return n;
    return {
      ...n,
      position: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 3,
      },
    };
  });

  // refine spacing for siblings under each parent
  layouted = applyChildGrouping(layouted, edges);
  layouted = alignEndingsByBranch(layouted, edges);
  layouted = centerGraphOnRoot(layouted);

  return layouted;
}

// maintain old API
export function centerSiblings(nodes, edges) {
  return getLayoutedNodes(nodes, edges);
}

/* ───────────────────────────── Helpers ───────────────────────────── */

/**
 * Keep siblings (A/B/C) horizontally grouped under each parent.
 */
function applyChildGrouping(nodes, edges) {
  const childMap = {};
  edges.forEach((e) => {
    if (!childMap[e.source]) childMap[e.source] = [];
    childMap[e.source].push(e.target);
  });

  Object.entries(childMap).forEach(([parentId, childrenIds]) => {
    const parent = nodes.find((n) => n.id === parentId);
    const children = childrenIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean);
    if (!parent || children.length < 2) return;

    const spacing = 300;
    const centerX = parent.position.x;
    const totalWidth = (children.length - 1) * spacing;
    const startX = centerX - totalWidth / 2;
    const targetY = parent.position.y + 240; // fixed vertical offset below parent

    children.forEach((c, i) => {
      c.position.x = startX + i * spacing;
      c.position.y = targetY;
    });
  });

  return nodes;
}

/**
 * Align endings (E1, E2, E3) directly under their branch’s last node
 */
function alignEndingsByBranch(nodes, edges) {
  const endings = nodes.filter((n) => /^E\d+$/i.test(n.id));
  if (!endings.length) return nodes;

  endings.forEach((end) => {
    // find the node that connects to this ending
    const edge = edges.find((e) => e.target === end.id);
    if (!edge) return;
    const parent = nodes.find((n) => n.id === edge.source);
    if (!parent) return;

    end.position.x = parent.position.x;
    end.position.y = parent.position.y + 220; // just below parent
  });

  return nodes;
}

/**
 * Center everything around the root node
 */
function centerGraphOnRoot(nodes) {
  const root =
    nodes.find((n) => n.id === "101") ||
    nodes.find((n) => n.id.toLowerCase() === "start") ||
    nodes[0];
  if (!root) return nodes;

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  const centerX = (minX + maxX) / 2;
  const deltaX = centerX - root.position.x;

  return nodes.map((n) => ({
    ...n,
    position: { ...n.position, x: n.position.x + deltaX },
  }));
}
