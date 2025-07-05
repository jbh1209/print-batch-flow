import { useState, useEffect } from "react";

interface FactoryFloorPreferences {
  hiddenStages: string[];
}

const DEFAULT_PREFERENCES: FactoryFloorPreferences = {
  hiddenStages: []
};

const STORAGE_KEY = 'factory-floor-preferences';

export const useFactoryFloorPreferences = () => {
  const [preferences, setPreferences] = useState<FactoryFloorPreferences>(DEFAULT_PREFERENCES);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences(parsed);
      }
    } catch (error) {
      console.warn('Failed to load factory floor preferences:', error);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  const savePreferences = (newPreferences: FactoryFloorPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (error) {
      console.warn('Failed to save factory floor preferences:', error);
    }
  };

  const toggleStageVisibility = (stageId: string) => {
    const newHiddenStages = preferences.hiddenStages.includes(stageId)
      ? preferences.hiddenStages.filter(id => id !== stageId)
      : [...preferences.hiddenStages, stageId];

    savePreferences({
      ...preferences,
      hiddenStages: newHiddenStages
    });
  };

  const resetPreferences = () => {
    savePreferences(DEFAULT_PREFERENCES);
  };

  const hideStage = (stageId: string) => {
    if (!preferences.hiddenStages.includes(stageId)) {
      savePreferences({
        ...preferences,
        hiddenStages: [...preferences.hiddenStages, stageId]
      });
    }
  };

  const showStage = (stageId: string) => {
    if (preferences.hiddenStages.includes(stageId)) {
      savePreferences({
        ...preferences,
        hiddenStages: preferences.hiddenStages.filter(id => id !== stageId)
      });
    }
  };

  const isStageVisible = (stageId: string) => {
    return !preferences.hiddenStages.includes(stageId);
  };

  return {
    preferences,
    toggleStageVisibility,
    resetPreferences,
    hideStage,
    showStage,
    isStageVisible
  };
};