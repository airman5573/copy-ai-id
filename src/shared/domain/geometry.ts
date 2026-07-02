// Preview-iframe (bridge) viewport geometry primitives.

export interface BridgeViewportSize {
  width: number;
  height: number;
}

export interface BridgeViewportPoint {
  x: number;
  y: number;
}

export interface BridgeViewportRect extends BridgeViewportPoint {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}
