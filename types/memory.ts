export type MemoryType = 'fact' | 'constraint' | 'summary' | 'context';

export interface MemoryProvenance {
  sourceMeetingId?: string;
  speakerId?: string;
  timestamp: string;
  confidence?: number;
}

export interface ProjectMemoryItem {
  id: string;
  projectId: string;
  type: MemoryType;
  key: string;
  content: string;
  provenance: MemoryProvenance;
  createdAt: string;
  updatedAt: string;
}
