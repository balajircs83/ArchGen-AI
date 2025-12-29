import React from 'react';
import { X, Info, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [width, setWidth] = React.useState(450);
  const [isResizing, setIsResizing] = React.useState(false);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.max(320, Math.min(window.innerWidth * 0.8, window.innerWidth - e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed right-0 top-0 h-full bg-gray-900/95 backdrop-blur-xl border-l border-gray-700 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col"
      style={{
        width: window.innerWidth < 768 ? '100%' : `${width}px`,
        transition: isResizing ? 'none' : 'transform 0.3s ease-in-out'
      }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-[60] hidden md:block"
      />
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
              <div className="prose prose-invert prose-blue max-w-none prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-8 first:prose-headings:mt-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {explanation}
                </ReactMarkdown>
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