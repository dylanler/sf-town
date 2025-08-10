import { Graphics } from '@pixi/react';
import * as PIXI from 'pixi.js';

export default function POIMarker({ x, y, onClick }: { x: number; y: number; onClick?: () => void }) {
  // Simple SVG-like pin rendered via Pixi Graphics
  return (
    <Graphics
      x={x}
      y={y}
      interactive
      pointerdown={() => onClick?.()}
      draw={(g) => {
        g.clear();
        // pin body
        g.beginFill(0xff3366);
        g.lineStyle(2, 0xffffff, 1);
        g.drawCircle(0, 0, 6);
        g.endFill();
        // pin tail
        g.lineStyle(2, 0xff3366, 1);
        g.moveTo(0, 6);
        g.lineTo(0, 14);
        // inner dot
        g.beginFill(0xffffff);
        g.drawCircle(0, 0, 2);
        g.endFill();
      }}
    />
  );
}


