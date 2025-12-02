import React from 'react';
import { X, Info, Zap } from 'lucide-react';
import { Node } from 'reactflow';
import { ArchitectureNodeData } from '../types';

interface InfoPanelProps {
  explanation: string | null;
  selectedNode: Node<ArchitectureNodeData> | null;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ explanation, selectedNode, isOpen, onClose, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-full md:w-[450px] bg-gray-900/95 backdrop-blur-xl border-l border-gray-700 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-gray-700">
        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          {selectedNode ? selectedNode.data.label : title || "Architecture Details"}
        </h2>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {selectedNode ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <div className="flex items-center gap-2 mb-4 text-blue-400">
                <Info className="w-5 h-5" />
                <h3 className="font-semibold uppercase tracking-wider text-sm">Component Details</h3>
              </div>
              <p className="text-gray-300 leading-relaxed">{selectedNode.data.details}</p>
            </div>

            {selectedNode.data.technologies && selectedNode.data.technologies.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center gap-2 mb-4 text-purple-400">
                  <Zap className="w-5 h-5" />
                  <h3 className="font-semibold uppercase tracking-wider text-sm">Technologies</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.data.technologies.map((tech) => (
                    <span key={tech} className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-200 border border-gray-600">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <button 
                onClick={() => onClose()} // Actually this should likely revert to general view, but close is fine for now
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors border border-gray-700"
            >
                Back to Architecture Overview
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {explanation ? (
                <div className="prose prose-invert prose-blue max-w-none">
                     {/* We render markdown simply as text blocks for safety/simplicity, 
                         or could use react-markdown. Given constraints, simple parsing is safer if no external deps allowed, 
                         but standard library react-markdown was allowed. 
                         Let's just use simple whitespace handling for now. 
                     */}
                     {explanation.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-white">{line.replace('## ', '')}</h2>;
                        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-4 text-white">{line.replace('# ', '')}</h1>;
                        if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-2 text-gray-300">{line.replace('- ', '')}</li>;
                        if (line.trim() === '') return <div key={i} className="h-4" />;
                        return <p key={i} className="text-gray-300 mb-2 leading-relaxed">{line}</p>;
                     })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <Info className="w-12 h-12 mb-4 opacity-20" />
                    <p>Select a node or generate a system to see details.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoPanel;