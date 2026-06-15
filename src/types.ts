export type DetectionType = 'face' | 'object' | 'expression';

export interface DetectionLog {
  id: string;
  timestamp: number;
  type: DetectionType;
  label: string;
  confidence: number;
}

export interface RegisteredFace {
  id: string;
  name: string;
  descriptor: Float32Array; // The embeddings 128D
}

export interface VisionState {
  isModelsLoaded: boolean;
  isDetecting: boolean;
  facesRegistered: RegisteredFace[];
  logs: DetectionLog[];
}
