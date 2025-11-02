export interface FinishingPreset {
  id: string;
  label: string;
  stages: string[];
  description?: string;
}

export const FINISHING_STAGE_NAMES = [
  'Handwork',
  'Box Gluing',
  'Gathering',
  'Padding',
  'Round Corners',
  'Wire Binding'
];

export const FINISHING_PRESETS: FinishingPreset[] = [
  {
    id: 'all',
    label: 'All Finishing Stages',
    stages: FINISHING_STAGE_NAMES,
    description: 'View all finishing operations'
  },
  {
    id: 'binding',
    label: 'Binding Operations',
    stages: ['Wire Binding'],
    description: 'Wire binding work'
  },
  {
    id: 'assembly',
    label: 'Assembly Work',
    stages: ['Box Gluing', 'Gathering', 'Padding'],
    description: 'Assembly and boxing operations'
  },
  {
    id: 'specialty',
    label: 'Specialty Finishing',
    stages: ['Handwork', 'Round Corners'],
    description: 'Manual and specialty work'
  }
];

export const getPresetById = (presetId: string): FinishingPreset | undefined => {
  return FINISHING_PRESETS.find(p => p.id === presetId);
};

export const getPresetForStages = (stageNames: string[]): FinishingPreset | undefined => {
  return FINISHING_PRESETS.find(preset => {
    if (preset.stages.length !== stageNames.length) return false;
    const sortedPreset = [...preset.stages].sort();
    const sortedStages = [...stageNames].sort();
    return sortedPreset.every((stage, index) => stage === sortedStages[index]);
  });
};
