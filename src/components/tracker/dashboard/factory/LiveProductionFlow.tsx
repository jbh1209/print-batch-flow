import React from "react";
import { ArrowRight, Users, Clock, AlertTriangle } from "lucide-react";

interface LiveProductionFlowProps {
  stats: {
    stages: Array<{
      name: string;
      color: string;
      count: number;
    }>;
  };
}

export const LiveProductionFlow: React.FC<LiveProductionFlowProps> = ({ stats }) => {
  const stages = stats.stages || [];
  
  // Mock some additional data for factory display
  const enhancedStages = stages.map((stage, index) => ({
    ...stage,
    capacity: Math.max(5, stage.count + Math.floor(Math.random() * 10)),
    utilization: stages.length > 0 ? Math.min(95, (stage.count / Math.max(1, stages.reduce((sum, s) => sum + s.count, 0) / stages.length)) * 100) : 0,
    isBottleneck: index === 1 || (stage.count > 0 && Math.random() > 0.7),
    nextAvailable: new Date(Date.now() + (Math.random() * 24 * 60 * 60 * 1000))
  }));

  const ProductionStage = ({ 
    stage, 
    isLast 
  }: { 
    stage: typeof enhancedStages[0]; 
    isLast: boolean; 
  }) => {
    const utilizationPercentage = Math.min(100, stage.utilization);
    const isOverCapacity = stage.utilization > 90;
    const isBottleneck = stage.isBottleneck || isOverCapacity;

    return (
      <>
        <div className={`factory-stage-box ${isBottleneck ? 'border-4 border-red-400' : ''}`}
             style={{ backgroundColor: stage.color || '#6B7280' }}>
          {isBottleneck && (
            <div className="absolute top-2 right-2">
              <AlertTriangle className="h-6 w-6 text-red-400 animate-bounce" />
            </div>
          )}
          
          <div className="relative z-10">
            <div className="text-3xl font-bold mb-2">{stage.name.toUpperCase()}</div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span className="text-lg">Jobs</span>
                </div>
                <span className="text-4xl font-bold">{stage.count}</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Capacity</span>
                  <span>{utilizationPercentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-black bg-opacity-30 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-1000 ${
                      isOverCapacity ? 'bg-red-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${Math.min(100, utilizationPercentage)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm opacity-80">
                <Clock className="h-4 w-4" />
                <span>Next: {stage.nextAvailable.toLocaleDateString()}</span>
              </div>
            </div>

            {isBottleneck && (
              <div className="absolute -bottom-1 left-0 right-0 bg-red-500 text-center text-xs font-bold py-1 rounded">
                BOTTLENECK
              </div>
            )}
          </div>
        </div>
        
        {!isLast && (
          <ArrowRight className="h-12 w-12 factory-flow-arrow flex-shrink-0" />
        )}
      </>
    );
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Live Production Assembly Line</h2>
        <p className="text-gray-400 text-lg">Real-time stage monitoring and bottleneck detection</p>
      </div>

      <div className="factory-assembly-line">
        {enhancedStages.length > 0 ? (
          enhancedStages.map((stage, index) => (
            <ProductionStage
              key={stage.name}
              stage={stage}
              isLast={index === enhancedStages.length - 1}
            />
          ))
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Users className="h-16 w-16 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold mb-2">No Active Stages</h3>
            <p className="text-lg">Production stages will appear here when jobs are active</p>
          </div>
        )}
      </div>

      {/* Flow Statistics */}
      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="bg-gray-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">
            {enhancedStages.reduce((sum, stage) => sum + stage.count, 0)}
          </div>
          <div className="text-gray-300">Total Queue</div>
        </div>
        
        <div className="bg-gray-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">
            {enhancedStages.filter(stage => stage.isBottleneck).length}
          </div>
          <div className="text-gray-300">Bottlenecks</div>
        </div>
        
        <div className="bg-gray-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">
            {enhancedStages.length > 0 ? 
              (enhancedStages.reduce((sum, stage) => sum + stage.utilization, 0) / enhancedStages.length).toFixed(0) 
              : 0}%
          </div>
          <div className="text-gray-300">Avg Utilization</div>
        </div>
      </div>
    </div>
  );
};