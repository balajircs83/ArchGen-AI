import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database, Server, User, Box, Globe, Layers, HardDrive } from 'lucide-react';
import { NodeType, ArchitectureNodeData } from '../types';

const icons: Record<NodeType, React.FC<{ className?: string }>> = {
  [NodeType.SERVICE]: Server,
  [NodeType.DATABASE]: Database,
  [NodeType.CLIENT]: User,
  [NodeType.QUEUE]: Layers,
  [NodeType.EXTERNAL]: Globe,
  [NodeType.CACHE]: HardDrive,
};

const colors: Record<NodeType, string> = {
  [NodeType.SERVICE]: 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
  [NodeType.DATABASE]: 'border-green-500 bg-green-50 text-green-900 dark:bg-green-900/40 dark:text-green-100',
  [NodeType.CLIENT]: 'border-purple-500 bg-purple-50 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100',
  [NodeType.QUEUE]: 'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100',
  [NodeType.EXTERNAL]: 'border-gray-400 bg-gray-100 text-gray-800 dark:border-gray-500 dark:bg-gray-800/60 dark:text-gray-200',
  [NodeType.CACHE]: 'border-red-500 bg-red-50 text-red-900 dark:bg-red-900/40 dark:text-red-100',
};

const CustomNode: React.FC<NodeProps<ArchitectureNodeData>> = ({ data, selected }) => {
  const Icon = icons[data.type] || Box;
  const colorClass = colors[data.type] || colors[NodeType.SERVICE];

  return (
    <div
      className={`relative rounded-xl border-2 px-4 py-3 shadow-lg backdrop-blur-md transition-all duration-300 w-64
      ${colorClass}
      ${selected ? 'ring-2 ring-fg scale-105 z-10' : 'hover:scale-105 hover:z-10'}
      `}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
      
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg bg-black/10 dark:bg-black/30`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="overflow-hidden">
          <h3 className="font-bold text-lg truncate" title={data.label}>{data.label}</h3>
          <p className="text-xs opacity-70 uppercase tracking-wider font-semibold">{data.type}</p>
        </div>
      </div>

      <p className="text-xs opacity-90 line-clamp-2 min-h-[2.5em] mb-2">{data.details}</p>

      {data.technologies && data.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {data.technologies.slice(0, 3).map((tech) => (
            <span key={tech} className="px-1.5 py-0.5 rounded text-[10px] bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10">
              {tech}
            </span>
          ))}
          {data.technologies.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10">
              +{data.technologies.length - 3}
            </span>
          )}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3" />
    </div>
  );
};

export default memo(CustomNode);