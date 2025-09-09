export const sampleNodes = [
  {
    id: '1',
    type: 'scenario',
    position: { x: 300, y: 50 },
    data: { label: 'A viral social media post is accusing the organization of unethical practices. What is your first move?' },
  },
  {
    id: '2',
    type: 'option',
    position: { x: 100, y: 200 },
    data: { label: 'OPTION A: Ignore the post, assuming it will blow over.' },
  },
  {
    id: '3',
    type: 'option',
    position: { x: 300, y: 200 },
    data: { label: 'OPTION B: Immediately convene an emergency meeting with the management team.' },
  },
  {
    id: '4',
    type: 'option',
    position: { x: 500, y: 200 },
    data: { label: 'OPTION C: Directly report the post to the platform and request its removal.' },
  },
  {
    id: '5',
    type: 'popup',
    position: { x: 100, y: 350 },
    data: { label: 'The rumors have spread to mainstream news outlets. What is your next step?' },
  },
  {
    id: '6',
    type: 'option',
    position: { x: 200, y: 350 },
    data: { label: 'B1: Prepare a public statement to address the allegations.' },
  },
  {
    id: '7',
    type: 'option',
    position: { x: 350, y: 350 },
    data: { label: 'B2: Conduct an internal investigation to gather facts and evidence.' },
  },
  {
    id: '8',
    type: 'option',
    position: { x: 500, y: 350 },
    data: { label: 'B3: Contact legal counsel for guidance on a response strategy.' },
  },
  {
    id: '9',
    type: 'ending',
    position: { x: 100, y: 500 },
    data: { label: 'E1: Complete Failure. The crisis has spiraled out of control, resulting in significant reputation loss and legal action.' },
  },
  {
    id: '10',
    type: 'ending',
    position: { x: 300, y: 500 },
    data: { label: 'E2: Partial Recovery. The public statement helped, but the initial delay caused lasting damage to credibility.' },
  },
  {
    id: '11',
    type: 'ending',
    position: { x: 500, y: 500 },
    data: { label: 'E3: Successful Resolution. The claims were disproven with evidence, and a coordinated response restored public trust.' },
  },
];

export const sampleEdges = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e1-3', source: '1', target: '3', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e1-4', source: '1', target: '4', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e2-5', source: '2', target: '5', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e5-9', source: '5', target: '9', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e3-6', source: '3', target: '6', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e3-7', source: '3', target: '7', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e3-8', source: '3', target: '8', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e6-10', source: '6', target: '10', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e7-11', source: '7', target: '11', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e8-11', source: '8', target: '11', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
  { id: 'e4-10', source: '4', target: '10', type: 'smoothstep', animated: true, updatable: true, deletable: true ,selectable: true},
];

export const sampleAiSuggestions = [
  { nodeType: 'option', label: 'Proactively issue a statement acknowledging the situation while you investigate.' },
  { nodeType: 'option', label: 'Engage with key influencers to counter the misinformation.' },
  { nodeType: 'popup', label: 'Ask if internal team members or former employees have been contacted by reporters.' },
  { nodeType: 'ending', label: 'Monitor media and social channels for any new developments.' },
];
