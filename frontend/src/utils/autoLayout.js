import dagre from "dagre";

const nodeWidth = 200;
const nodeHeight = 150;

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export function getLayoutedNodes(nodes, edges) {
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 250, nodesep: 300 });

  nodes.forEach(n => dagreGraph.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach(e => dagreGraph.setEdge(e.source, e.target));
  dagre.layout(dagreGraph);

  return nodes.map(n => {
    const pos = dagreGraph.node(n.id);
    return pos
      ? { ...n, position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 } }
      : n;
  });
}

export function centerSiblings(nodes, edges) {
  const groups = {};
  edges.forEach(e => {
    if (!groups[e.source]) groups[e.source] = [];
    groups[e.source].push(e.target);
  });

  Object.entries(groups).forEach(([parentId, childrenIds]) => {
    const parent = nodes.find(n => n.id === parentId);
    const children = childrenIds.map(id => nodes.find(n => n.id === id)).filter(Boolean);
    if (!parent || children.length < 2) return;

    const spacing = 250;
    const midX = parent.position.x;
    const totalWidth = (children.length - 1) * spacing;
    const startX = midX - totalWidth / 2;

    children.forEach((c, i) => (c.position.x = startX + i * spacing));
  });

  return nodes;
}
