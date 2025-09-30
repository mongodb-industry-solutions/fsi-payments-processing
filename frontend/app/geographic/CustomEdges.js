'use client';

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath } from 'reactflow';

export default function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleClick = () => {
    if (data?.onEdgeClick) {
      data.onEdgeClick(id, data);
    }
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              background: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              fontWeight: data.isActive ? 'bold' : 'normal',
              color: data.isActive ? '#764ba2' : '#64748b',
              pointerEvents: 'all',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            className="nodrag nopan"
            onClick={handleClick}
            onMouseEnter={(e) => {
              e.target.style.background = '#f0f9ff';
              e.target.style.borderColor = '#3b82f6';
              e.target.style.transform = `translate(-50%, -50%) translate(${labelX}px,${labelY}px) scale(1.05)`;
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white';
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.transform = `translate(-50%, -50%) translate(${labelX}px,${labelY}px) scale(1)`;
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
      {data?.isActive && (
        <circle r="8" fill="#764ba2">
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  );
}