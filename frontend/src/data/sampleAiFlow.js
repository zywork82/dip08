/*
* This file contains the node data for the scenario playthrough.
* Each option is tagged with a 'scores' object to enable psychological analysis.
*
* SCORING GUIDE:
* Bias Profile:
* +1: Confirmation Bias (choosing info that confirms pre-existing beliefs)
* +1: Confidence Bias (choosing overly assertive/confident options)
*
* Risk Tolerance:
* +1: Risk-Seeking (taking a gamble or an aggressive action)
* -1: Risk-Averse (choosing the safe, cautious, or information-gathering option)
*
* Time vs. Relationship Orientation:
* +1: Efficiency-driven (prioritizing speed, tasks, or impersonal process)
* -1: Relationship-driven (prioritizing people, team cohesion, or communication)
*
* Critical Thinking Disposition:
* +1: Analytical (choosing to gather data, analyze, or think deeply)
* -1: Intuitive (choosing based on a gut feeling or a quick judgment)
*
* Note: Analytical Depth is calculated purely from response time, so it is not scored here.
*/
export const sampleNodes = {
  // --- SCENARIO 1 ---
  '101': {
    id: '101',
    type: 'scenario',
    position: { x: 300, y: 50 },
    data: 'A viral post is spreading about your organization. What do you do first?',
    scene: 'The president ow ow',
    options: ['101_A', '101_B'],
    b64image: 'imagesample'
  },
  '101_A': {
    id: '101_A',
    type: 'option',
    position: { x: 100, y: 200 },
    data: 'OPTION A: Ignore it and hope it dies down.' ,
    next: '201',
    scores: {
      bias_confirmation: 0,
      bias_confidence: 0,
      risk_tolerance: 1,     // Risk-seeking (doing nothing is a gamble)
      time_vs_relationship: 0,
      thinking_disposition: -1, // Intuitive (not analyzing the threat)
    }
  },
  '101_B': {
    id: '101_B',
    type: 'option',
    position: { x: 300, y: 200 },
    data: 'OPTION B: Alert your Exco and call for emergency meeting.',
    next: '202',
    scores: {
      bias_confirmation: 0,
      bias_confidence: 0,
      risk_tolerance: -1,    // Risk-averse (involving a team to manage risk)
      time_vs_relationship: -1, // Relationship-driven (involving people)
      thinking_disposition: 1,  // Analytical (starting a formal process)
    }
  },

  // --- SCENARIO 2 (Path from 101_A) ---
  '201': {
    id: '201',
    type: 'scenario',
    position: { x: 300, y: 50 },
    data: 'You ignored it. The post is now trending. What do you do?',
    scene: 'whatever 1',
    options: ['201_A', '201_B'],
    b64image: 'imagesample'
  },
  '201_A': {
    id: '201_A',
    type: 'option',
    data: "OPTION A: Double down and continue to ignore it. It's just internet noise.",
    next: '301',
    scores: {
      bias_confirmation: 1, // Confirmation Bias (confirming your initial belief that it's "noise")
      bias_confidence: 1,  // Confidence Bias (overly confident in your inaction)
      risk_tolerance: 1,
      time_vs_relationship: 0,
      thinking_disposition: -1,
    }
  },
  '201_B': {
    id: '201_B',
    type: 'option',
    data:'OPTION B: Issue a formal statement immediately to counter the narrative.',
    next: '302',
    scores: {
      bias_confirmation: 0,
      bias_confidence: 0,
      risk_tolerance: 0, // Neutral (it's both risky and a form of control)
      time_vs_relationship: 1, // Efficiency-driven (task-focused response)
      thinking_disposition: 0,
    }
  },

  // --- SCENARIO 2 (Path from 101_B) ---
  '202': {
    id: '202',
    type: 'scenario',
    data: 'In the meeting, one group wants to act now, another wants to wait for more data. What do you do?',
    scene: 'whatever 2',
    options: ['202_A', '202_B'],
    b64image: 'imagesample'
  },
  '202_A': {
    id: '202_A',
    type: 'option',
    data: "OPTION A: Make a decisive call to act now. You're the leader.",
    next: '302',
    scores: {
      bias_confirmation: 0,
      bias_confidence: 1,  // Confidence Bias
      risk_tolerance: 1,  // Risk-seeking (acting without full data)
      time_vs_relationship: 1,  // Efficiency-driven
      thinking_disposition: -1, // Intuitive (making a "leader" call)
    }
  },
  '202_B': {
    id: '202_B',
    type: 'option',
    data:'OPTION B: Listen to the cautious group and wait 24 hours to gather facts.',
    next: '303',
    scores: {
      bias_confirmation: 0,
      bias_confidence: 0,
      risk_tolerance: -1, // Risk-averse
      time_vs_relationship: -1, // Relationship-driven (listening to the group)
      thinking_disposition: 1,  // Analytical
    }
  },

  // --- END STATES ---
  '301': {
    id: '301',
    type: 'endScenario',
    data: 'By ignoring the problem, it has escalated into a full-blown crisis. Your team is now in damage control.',
    scene: 'whatever 3',
    options: [], // Empty options = end of playthrough
    b64image: 'imagesample'
  },
  '302': {
    id: '302',
    type: 'endScenario',
    data: 'Your quick statement has helped control the narrative, though some damage was unavoidable.',
    scene: 'whatever 4',
    options: [],
    b64image: 'imagesample'
  },
  '303': {
    id: '303',
    type: 'endScenario',
    data: 'Waiting allowed you to gather facts and issue a comprehensive, accurate statement that defused the situation.',
    scene: 'whatever 5',
    options: [],
    b64image: 'imagesample'
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