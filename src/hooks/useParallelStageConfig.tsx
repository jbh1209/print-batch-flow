import { useState, useCallback, useEffect } from 'react';

interface ParallelStageConfig {
  showParallelStagesSeparately: boolean;
}

const STORAGE_KEY = 'parallel-stage-config';

const DEFAULT_CONFIG: ParallelStageConfig = {
  showParallelStagesSeparately: true
};

export const useParallelStageConfig = () => {
  const [config, setConfig] = useState<ParallelStageConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const updateConfig = useCallback((updates: Partial<ParallelStageConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      return newConfig;
    });
  }, []);

  const toggleParallelStagesSeparately = useCallback(() => {
    updateConfig({ showParallelStagesSeparately: !config.showParallelStagesSeparately });
  }, [config.showParallelStagesSeparately, updateConfig]);

  return {
    config,
    updateConfig,
    toggleParallelStagesSeparately
  };
};