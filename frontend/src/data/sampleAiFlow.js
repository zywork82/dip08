// sampleAiFlow.js

export const sampleNodes = {
  '101': {
    id: '101',
    type: 'scenario',
    position: { x: 300, y: 50 },
    data: 'A viral post is spreading. What do you do first?',
    // ADDED: This connects the scenario to its options
    scene: 'The president ow ow',
    options: ['101_A', '101_B'],
    b64image: 'imagesample' 
  }, 

  '201': {
    id: '201',
    type: 'scenario',
    position: { x: 300, y: 50 },
    data: 'Some people in school approached you to ask you questions. What would you do?',
    scene: 'whatever 1',
    options: ['201_A', '201_B'],
    b64image: 'imagesample' 
  }, 

  '301': {
    id: '301',
    type: 'ending',
    position: { x: 300, y: 50 },
    data: '301 happened 301 this',
    scene: 'whatever 3',
    options: ['301_A', '301_B'],
    b64image: 'imagesample3' 
  }, 

  '302': {
    id: '302',
    type: 'scenario',
    position: { x: 300, y: 50 },
    data: '302 happened 302 this',
    scene: 'whatever 3',
    options: ['302_A', '302_B'],
    b64image: 'imagesample3'
  },

  '401': {
    id: '401', 
    type:'ending',
    position: { x: 300, y: 50 },
    data: 'As time passes, more people grew aware of the dire situation.', 
    scene: 'whatever 4',
    options: [],
    b64image: 'imagesample4'
  },

  //OPTIONS
  '101_A': {
    id: '101_A',
    type: 'option',
    position: { x: 100, y: 200 },
    data: 'OPTION A: Ignore it and hope it dies down.',
    // ADDED: This tells us where Option A leads
    next: '201', 
  },

  '101_B': {
    id: '101_B',
    type: 'option',
    position: { x: 300, y: 200 },
    data: 'OPTION B: Alert your Exco and call for emergency meeting.',
    // ADDED: This tells us where Option B leads
    next: '201',
  },

  '201_A': {
    id: '201_A',
    type: 'option',
    position: { x: 100, y: 200 },
    data:'OPTION A: Run away.',
    // ADDED: This tells us where Option A leads
    next: '201', 
  },

  '201_B': {
    id: '201_B',
    type: 'option',
    position: { x: 100, y: 200 },
    data:'OPTION B: Listen to what they have to say.',
    // ADDED: This tells us where Option A leads
    next: '301', 
  }, 

  '301_A': {
    id: '301_A',
    type: 'option',
    position: { x: 100, y: 200 },
    data:'OPTION A: 301_A',
    // ADDED: This tells us where Option A leads
    next: '401', 
  }, 

  '301_B': {
    id: '301_B',
    type: 'option',
    position: { x: 100, y: 200 },
    data:'OPTION B: 301_B',
    // ADDED: This tells us where Option A leads
    next: '401', 
  }

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