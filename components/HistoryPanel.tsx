import React from 'react';
import { X, Clock, ChevronRight, Trash2, Layout } from 'lucide-react';
import { SavedArchitecture } from '../types';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: SavedArchitecture[];
  onSelect: (item: SavedArchitecture) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  currentId?: string;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onSelect, 
  onDelete,
  currentId 
}) => {
  return (
    <div 
      className={`fixed left-0 top-0 h-full w-full md:w-[320px] bg-gray-900/95 backdrop-blur-xl border-r border-gray-700 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between p-6 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-white">History</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-center px-4">
            <Layout className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No architectures generated yet.</p>
            <p className="text-xs mt-1 opacity-60">Your generated designs will appear here.</p>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className={`group relative flex flex-col gap-2 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                currentId === item.id 
                  ? 'bg-blue-900/20 border-blue-500/50' 
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <h3 className={`font-semibold text-sm line-clamp-1 ${currentId === item.id ? 'text-blue-200' : 'text-gray-200'}`}>
                  {item.title}
                </h3>
                <button
                  onClick={(e) => onDelete(item.id, e)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded-md transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                {item.prompt}
              </p>

              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-500 font-medium">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
                <ChevronRight className={`w-3 h-3 ${currentId === item.id ? 'text-blue-400' : 'text-gray-600'}`} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;