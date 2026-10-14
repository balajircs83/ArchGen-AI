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
      className="fixed right-0 top-0 h-full bg-surface border-l border-line shadow-2xl z-[60] transform transition-transform duration-300 flex flex-col"
      style={{
        width: window.innerWidth < 768 ? '100%' : `${width}px`,
        transition: isResizing ? 'none' : 'transform 0.3s ease-in-out'
      }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-accent transition-colors z-[60] hidden md:block"
      />
      <div className="flex items-center justify-between p-6 border-b border-line">
        <h2 className="text-xl font-bold text-fg">
          {selectedNode ? selectedNode.data.label : title || "Architecture Details"}
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-surface2 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {selectedNode ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-surface2 rounded-xl p-5 border border-line">
              <div className="flex items-center gap-2 mb-4 text-fg">
                <Info className="w-5 h-5" />
                <h3 className="font-semibold uppercase tracking-wider text-sm">Component Details</h3>
              </div>
              <p className="text-fg leading-relaxed">{selectedNode.data.details}</p>
            </div>

            {selectedNode.data.technologies && selectedNode.data.technologies.length > 0 && (
              <div className="bg-surface2 rounded-xl p-5 border border-line">
                <div className="flex items-center gap-2 mb-4 text-fg">
                  <Zap className="w-5 h-5" />
                  <h3 className="font-semibold uppercase tracking-wider text-sm">Technologies</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.data.technologies.map((tech) => (
                    <span key={tech} className="px-3 py-1 bg-line rounded-full text-sm text-fg border border-line">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => onClose()} // Actually this should likely revert to general view, but close is fine for now
              className="w-full py-3 bg-surface2 hover:bg-line text-sm font-medium rounded-lg transition-colors border border-line"
            >
              Back to Architecture Overview
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {explanation ? (
              <div className="prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-8 first:prose-headings:mt-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {(Array.isArray(explanation) ? (explanation as any[]).join('\n') : explanation).replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted">
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