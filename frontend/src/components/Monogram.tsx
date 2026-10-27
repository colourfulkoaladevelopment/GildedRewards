import React from "react";
import Svg, { Path, Polygon } from "react-native-svg";

// Minimalist geometric "L" monogram inside a diamond, rendered as vector gold.
export function Monogram({ size = 72, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points="50,6 94,50 50,94 6,50" fill="none" stroke={color} strokeWidth={2} />
      <Polygon points="50,20 80,50 50,80 20,50" fill="none" stroke={color} strokeWidth={1} opacity={0.5} />
      <Path d="M42 34 L42 64 L62 64" fill="none" stroke={color} strokeWidth={4} strokeLinecap="square" />
    </Svg>
  );
}
