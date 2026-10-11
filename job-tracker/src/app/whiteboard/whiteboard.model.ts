/** Every client draws in the same logical space and scales it to fit, so strokes line up on any screen size. */
export const BOARD_W = 1600;
export const BOARD_H = 1000;

export type Tool = 'pen' | 'eraser';

export interface Stroke {
  id: string;
  userId: string;
  tool: Tool;
  color: string;
  size: number;
  /** Flat [x0, y0, x1, y1, ...] in board coordinates; half the JSON of an array of pairs. */
  points: number[];
}

export interface Peer {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
}

export type ClientMessage =
  | { type: 'hello'; name: string; color: string }
  | { type: 'begin'; stroke: Stroke }
  | { type: 'points'; id: string; points: number[] }
  | { type: 'undo'; id: string }
  | { type: 'clear' }
  | { type: 'cursor'; x: number | null; y: number | null };

export type ServerMessage =
  | { type: 'welcome'; strokes: Stroke[]; peers: Peer[] }
  | { type: 'peer'; peer: Peer }
  | { type: 'leave'; id: string }
  | { type: 'begin'; stroke: Stroke }
  | { type: 'points'; id: string; points: number[] }
  | { type: 'undo'; id: string }
  | { type: 'clear'; by: string }
  | { type: 'cursor'; id: string; x: number | null; y: number | null };

export const PEN_COLORS = [
  { value: '#1d2142', label: 'Ink' },
  { value: '#3557d4', label: 'Blue' },
  { value: '#7a4fe0', label: 'Violet' },
  { value: '#1f8a4c', label: 'Green' },
  { value: '#e8890c', label: 'Amber' },
  { value: '#d6336c', label: 'Pink' },
];

export const PEN_SIZES = [
  { value: 3, label: 'Fine' },
  { value: 7, label: 'Medium' },
  { value: 16, label: 'Bold' },
];

export const ERASER_SIZE = 36;
