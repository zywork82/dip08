// sampleAiFlow.js

export const sampleNodes = [
  // Main scenario
  {
    id: '101',
    type: 'scenario',
    position: { x: 300, y: 50 },
    data: { label: 'A viral post is spreading. What do you do first?' },
  },
  // Options
  {
    id: '102',
    type: 'option',
    position: { x: 100, y: 200 },
    data: { label: 'OPTION A: Ignore it and hope it dies down.' },
  },
  {
    id: '103',
    type: 'option',
    position: { x: 300, y: 200 },
    data: { label: 'OPTION B: Alert your Exco and call for emergency meeting.' },
  },
  {
    id: '104',
    type: 'option',
    position: { x: 500, y: 200 },
    data: { label: 'OPTION C: Report the post to the platform.' },
  },
  // Follow-up options / popups
  {
    id: '105',
    type: 'popup',
    position: { x: 300, y: 350 },
    data: { label: 'EXCO suggests issuing a statement.' },
  },
  {
    id: '106',
    type: 'ending',
    position: { x: 100, y: 400 },
    data: { label: 'The post dies down, nothing happens.' },
  },
  {
    id: '107',
    type: 'ending',
    position: { x: 500, y: 400 },
    data: { label: 'Platform removes the post. Crisis averted.' },
  },
];

export const sampleEdges = [
  { id: 'e101-102', source: '101', target: '102', type: 'smoothstep', animated: true },
  { id: 'e101-103', source: '101', target: '103', type: 'smoothstep', animated: true },
  { id: 'e101-104', source: '101', target: '104', type: 'smoothstep', animated: true },
  { id: 'e103-105', source: '103', target: '105', type: 'smoothstep', animated: true },
  { id: 'e102-106', source: '102', target: '106', type: 'smoothstep', animated: true },
  { id: 'e104-107', source: '104', target: '107', type: 'smoothstep', animated: true },
];

export const sampleAiSuggestions = [
  { nodeType: 'option', label: 'Check the source of the post before taking action.' },
  { nodeType: 'option', label: 'Notify your team about potential risks.' },
  { nodeType: 'option', label: 'Prepare a public statement.' },
  { nodeType: 'ending', label: 'Ignore post and monitor reactions.' },
];