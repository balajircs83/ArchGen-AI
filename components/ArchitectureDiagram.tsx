import React, { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType,
} from 'reactflow';
import CustomNode from './CustomNode';
import { GeneratedArchitecture, ArchitectureNodeData } from '../types';
import { getLayoutedElements } from '../utils/layout';

const nodeTypes = {
  custom: CustomNode,
};

interface ArchitectureDiagramProps {
  data: GeneratedArchitecture | null;
  onNodeClick: (node: Node<ArchitectureNodeData>) => void;
}

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ data, onNodeClick }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!data) return;

    const initialNodes: Node<ArchitectureNodeData>[] = data.nodes.map((n) => ({
      id: n.id,
      type: 'custom',
      data: {
        label: n.label,
        type: n.type,
        details: n.details,
        technologies: n.technologies,
      },
      position: { x: 0, y: 0 }, // Initial position, will be fixed by layout
    }));

    const initialEdges: Edge[] = data.edges.map((e, index) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label ? `${index + 1}. ${e.label}` : `${index + 1}`,
      animated: true, // Key for data flow visualization
      style: {
        stroke: '#60a5fa',
        strokeWidth: 2,
        strokeDasharray: '6', // Explicitly define dasharray to ensure it's captured
      },
      labelStyle: { fill: '#60a5fa', fontWeight: 700, fontSize: 10 },
      labelBgStyle: { fill: '#111827', fillOpacity: 0.9 },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#60a5fa',
      },
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      'TB' // Top to Bottom flow by default
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [data, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Memoize background color for dark mode
  const bgColor = '#111827'; // gray-900

  return (
    <div className="w-full h-full text-black relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick(node)}
        fitView
        className="bg-gray-900"
        minZoom={0.1}
        maxZoom={1.5}
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls
          className="!flex !flex-col !gap-1 !p-1 !bg-gray-900/40 !backdrop-blur-xl !border !border-white/10 !rounded-2xl !shadow-2xl [&>button]:!bg-white/5 [&>button]:!border-none [&>button]:!rounded-xl [&>button]:!w-10 [&>button]:!h-10 [&>button:hover]:!bg-blue-600/50 [&>button]:!transition-all [&>button>svg]:!fill-white/80 [&>button]:!flex [&>button]:!items-center [&>button]:!justify-center"
          showInteractive={false}
          position="bottom-left"
        />
        <MiniMap
          nodeColor={(n) => {
            switch (n.data.type) {
              case 'database': return '#22c55e';
              case 'service': return '#3b82f6';
              case 'client': return '#a855f7';
              default: return '#6b7280';
            }
          }}
          className="!bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
          maskColor="rgba(0, 0, 0, 0.4)"
        />
      </ReactFlow>
    </div>
  );
};

export default ArchitectureDiagram;