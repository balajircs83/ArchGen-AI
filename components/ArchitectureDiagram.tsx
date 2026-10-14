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
  theme: 'dark' | 'light';
  showMiniMap?: boolean;
  onNodeClick: (node: Node<ArchitectureNodeData>) => void;
}

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ data, onNodeClick, theme, showMiniMap = true }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const dark = theme === 'dark';
  const edgeColor = dark ? '#60a5fa' : '#2563eb';
  const bgColor = dark ? '#171a20' : '#ffffff';

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
        stroke: edgeColor,
        strokeWidth: 2,
        strokeDasharray: '6', // Explicitly define dasharray to ensure it's captured
      },
      labelStyle: { fill: edgeColor, fontWeight: 700, fontSize: 10 },
      labelBgStyle: { fill: bgColor, fillOpacity: 0.9 },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
      },
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      'TB' // Top to Bottom flow by default
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [data, theme, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick(node)}
        fitView
        className="bg-surface"
        minZoom={0.1}
        maxZoom={1.5}
      >
        <Background color={dark ? '#2a2f39' : '#d9d6cb'} gap={20} size={1} />
        <Controls
          className="!rounded-lg !overflow-hidden !border !border-line !shadow-none"
          showInteractive={false}
          position="bottom-left"
        />
        {showMiniMap && <MiniMap
          nodeColor={(n) => {
            switch (n.data.type) {
              case 'database': return '#22c55e';
              case 'service': return '#3b82f6';
              case 'client': return '#a855f7';
              default: return '#6b7280';
            }
          }}
          className="!bg-surface2 border border-line rounded-lg overflow-hidden"
          maskColor={dark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.08)'}
        />}
      </ReactFlow>
    </div>
  );
};

export default ArchitectureDiagram;