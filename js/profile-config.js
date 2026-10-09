// Pip's learner profile seed and run-time settings.
// The coordinator/parent can fill this in; the app merges it with what Pip learns on the device (js/memory.js).
// Keep it to first names and interests only. Nothing here is secret: it ships with the public site.
export const PROFILE_SEED = {
  child: { name: 'Arisha', age: 6, year: 'Year 1', city: 'Melbourne' },
  // People Pip can share things between. role drives the avatar: mum, dad, brother, sister, nan, pop, teacher, friend.
  family: [
    { name: 'Mum', role: 'mum' },
    { name: 'Dad', role: 'dad' },
  ],
  pets: [],                 // e.g. { name: 'Biscuit', kind: 'dog' }
  favourites: ['Tim Tams', 'strawberries'], // foods/things to share
  interests: [],            // e.g. 'Bluey', 'drawing', 'soccer'
  notes: '',                // anything a parent wants Pip to know (plain words)
};

export const SETTINGS = {
  agentId: 'agent_2001m4g45xbaf3gr4g61qrw64xyz',
  proxyBase: 'https://hermes.redgumlab.au/pip',
  sessionMinutes: 15,       // hard cap per session (also enforced by the agent: max_duration_seconds)
  dailyMinutes: 40,         // total live-tutor minutes per day on this device
  dailySessions: 6,
  idleNudgeSeconds: 20,     // Pip checks in if nothing happens for this long during a lesson
  stuckWrongTries: 2,       // Pip offers help after this many unhelpful checks in a row
  cameraSnapshotSeconds: 4, // while camera mode is open, how often Pip looks on her own
  curriculumFocus: 'sharing equally (VC2M1N06), extension counting to 120',
};
