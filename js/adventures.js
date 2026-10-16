// Serializable story plans. The app resolves moduleId/skillId when a mission starts.

export const PICNIC_ADVENTURE = {
  id: 'picnic-party',
  title: "Pip's Picnic Adventure",
  intro: 'Pip is getting ready for a picnic. Help her finish three maths jobs.',
  outro: 'What a picnic! Brilliant maths, Arisha!',
  buttonLabel: 'Start the picnic',
  resumeLabel: 'Continue the picnic',
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

export const LOST_BILBY_ADVENTURE = {
  id: 'lost-bilby',
  title: 'Lost Bilby',
  intro: 'A little bilby is missing in the bush. Follow the clues with Pip and help Bilby get home.',
  outro: 'Bilby is safe at home. You solved every clue!',
  buttonLabel: 'Find Bilby',
  resumeLabel: 'Keep looking',
  stages: [
    {
      id: 'read-shape-clue',
      moduleId: 'explore',
      skillId: 'explore.shapes',
      level: 1,
      title: 'Read the Shape Clue',
      intro: 'The first sign has a shape clue. Find the shape that fits.',
      outro: 'The shape points toward the gum trees.',
    },
    {
      id: 'follow-track-pattern',
      moduleId: 'explore',
      skillId: 'explore.patterns',
      level: 1,
      title: 'Follow the Track Pattern',
      intro: 'Coloured track markers make a repeating pattern. Work out what comes next.',
      outro: 'The pattern leads farther along the path.',
    },
    {
      id: 'find-next-track-number',
      moduleId: 'numbers',
      skillId: 'numbers.beforeafter',
      level: 1,
      title: 'Find the Next Track Number',
      intro: 'A number is missing from the next trail sign. Find it to choose the path.',
      outro: 'The number sends Pip down the right path.',
    },
    {
      id: 'fill-bilby-basket',
      moduleId: 'sharing',
      skillId: 'sharing.one',
      level: 1,
      title: "Fill Bilby's Basket",
      intro: 'There is Bilby! Put all the food into one basket for the trip home.',
      outro: 'Bilby has a full basket and is ready to go home.',
    },
  ],
};

export const BAKERY_ADVENTURE = {
  id: 'pips-bakery',
  title: "Pip's Bakery",
  intro: 'Pip is opening her bakery. Help her check the ingredients, prepare the boxes and serve the customers.',
  outro: "The bakery day is done. Pip's treats are packed and shared.",
  buttonLabel: 'Open the bakery',
  resumeLabel: 'Keep baking',
  stages: [
    {
      id: 'check-ingredient-chart',
      moduleId: 'explore',
      skillId: 'explore.charts',
      level: 1,
      title: 'Check the Ingredient Chart',
      intro: 'First, read the picture chart to check the bakery ingredients.',
      outro: 'The ingredient check is complete.',
    },
    {
      id: 'measure-box-ribbons',
      moduleId: 'explore',
      skillId: 'explore.measure',
      level: 1,
      title: 'Measure the Box Ribbons',
      intro: 'The treat boxes need ribbons. Compare their lengths.',
      outro: 'The right ribbon is ready for a box.',
    },
    {
      id: 'pack-treat-bags',
      moduleId: 'groups',
      skillId: 'groups.howmany',
      level: 1,
      title: 'Pack the Treat Bags',
      intro: 'Now put the treats into equal bags and count the bags.',
      outro: 'The treat bags are packed.',
    },
    {
      id: 'share-bakery-treats',
      moduleId: 'sharing',
      skillId: 'sharing.groups',
      level: 1,
      title: 'Share the Treats',
      intro: 'Friends arrive at the bakery. Share the treats fairly.',
      outro: 'Every friend has a fair share.',
    },
    {
      id: 'count-cookie-leftovers',
      moduleId: 'addsub',
      skillId: 'addsub.sub',
      level: 1,
      title: 'Count the Cookies Left',
      intro: 'At closing time, some cookies are eaten. Work out how many are left.',
      outro: 'You counted the cookies left at closing time.',
      params: { storyKind: 'snacks' },
    },
  ],
};

export const TRAIN_RESCUE_ADVENTURE = {
  id: 'train-rescue',
  title: 'Train Rescue',
  intro: "Pip's train has stopped before the station. Fix the number clues and get everyone moving again.",
  outro: 'The train is moving again. Everyone can finish the journey!',
  buttonLabel: 'Start the rescue',
  resumeLabel: 'Continue the rescue',
  stages: [
    {
      id: 'order-carriage-numbers',
      moduleId: 'numbers',
      skillId: 'numbers.order',
      level: 1,
      title: 'Order the Carriage Numbers',
      intro: 'The carriage number cards are mixed up. Put them in order.',
      outro: 'The carriage numbers are back in order.',
    },
    {
      id: 'repair-signal-pattern',
      moduleId: 'explore',
      skillId: 'explore.patterns',
      level: 1,
      title: 'Repair the Signal Pattern',
      intro: 'The signal cards make a repeating pattern. Work out what comes next.',
      outro: 'The signal pattern is repaired.',
    },
    {
      id: 'find-next-track-number',
      moduleId: 'numbers',
      skillId: 'numbers.beforeafter',
      level: 1,
      title: 'Find the Next Track Number',
      intro: 'A track number is missing from the route. Find the next number.',
      outro: 'The route is clear to the station.',
    },
    {
      id: 'count-passengers',
      moduleId: 'groups',
      skillId: 'groups.tens',
      level: 1,
      title: 'Count the Passengers',
      intro: 'The counters show passengers. Count them in tens before the train leaves.',
      outro: 'Everyone is counted and ready for the station.',
    },
  ],
};

export const ADVENTURES = [PICNIC_ADVENTURE, LOST_BILBY_ADVENTURE, BAKERY_ADVENTURE, TRAIN_RESCUE_ADVENTURE];

export const ADVENTURE_VOICE_LINES = [...new Set(ADVENTURES.flatMap((adventure) => [
  adventure.title,
  adventure.intro,
  adventure.outro,
  adventure.buttonLabel,
  adventure.resumeLabel,
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
