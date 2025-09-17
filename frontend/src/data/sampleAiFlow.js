// sampleAiFlow.js

export const sampleNodes = {
  '101': {
    id: '101',
    type: 'scenario',
    position: { x: 300, y: 50 },
    data: { label: 'A viral post is spreading. What do you do first?' },
    // ADDED: This connects the scenario to its options
    options: ['102', '103'], 
  },
  // Options
  '102': {
    id: '102',
    type: 'option',
    position: { x: 100, y: 200 },
    data: { label: 'OPTION A: Ignore it and hope it dies down.' },
    // ADDED: This tells us where Option A leads
    next: '201', 
  },
  '103': {
    id: '103',
    type: 'option',
    position: { x: 300, y: 200 },
    data: { label: 'OPTION B: Alert your Exco and call for emergency meeting.' },
    // ADDED: This tells us where Option B leads
    next: '202',
  },
  // Follow-up options / popups

};

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