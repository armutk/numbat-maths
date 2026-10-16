// Serializable story plans. The app resolves moduleId/skillId when a mission starts.

export const PICNIC_ADVENTURE = {
  id: 'picnic-party',
  title: "Pip's Picnic Adventure",
  intro: 'Pip is getting ready for a picnic. Help her finish three maths jobs.',
  outro: 'What a picnic! Brilliant maths, Arisha!',
  stages: [
    {
      id: 'pack-bags',
      moduleId: 'groups',
      skillId: 'groups.howmany',
      level: 2,
      title: 'Pack the Picnic Bags',
      intro: 'First, pack the picnic supplies into equal bags.',
      outro: 'The picnic bags are packed.',
    },
    {
      id: 'share-snacks',
      moduleId: 'sharing',
      skillId: 'sharing.groups',
      level: 2,
      title: 'Share the Snacks',
      intro: 'The friends are here. Share the snacks fairly.',
      outro: 'Everyone has a fair share.',
    },
    {
      id: 'count-leftovers',
      moduleId: 'addsub',
      skillId: 'addsub.sub',
      level: 2,
      title: 'Count the Leftovers',
      intro: 'The picnic is over. Work out how many snacks are left.',
      outro: 'You counted the leftovers.',
      params: { storyKind: 'snacks' },
    },
  ],
};

export const ADVENTURES = [PICNIC_ADVENTURE];

export const ADVENTURE_VOICE_LINES = [...new Set(ADVENTURES.flatMap((adventure) => [
  adventure.title,
  adventure.intro,
  adventure.outro,
  ...adventure.stages.flatMap((stage) => [stage.title, stage.intro, stage.outro]),
]))];

function seedNumber(value) {
  const text = String(value ?? 1);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
export function getAdventure(id) {
  return ADVENTURES.find((adventure) => adventure.id === id) || null;
}

export function buildAdventurePlan({ adventureId = 'picnic-party', seed = 1 } = {}) {
  const adventure = getAdventure(adventureId);
  if (!adventure) return null;
  return adventure.stages.map((stage, index) => ({
    ...stage,
    id: `${adventure.id}:${stage.id}`,
    adventureId: adventure.id,
    adventureTitle: adventure.title,
    adventureIntro: adventure.intro,
    adventureOutro: adventure.outro,
    storyStage: index + 1,
    seed: seedNumber(`${seed}:${adventure.id}:${stage.id}`),
  }));
}
