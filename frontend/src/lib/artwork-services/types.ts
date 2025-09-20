// 艺术作品服务类型定义
export interface Artwork {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  imageUrl: string;
  description: string;
  museum: string;
  license: string;
}

export interface CurationInfo {
  theme: string;
  description: string;
  emotionCurve: number[];
  totalWorks: number;
}

export interface ArtworkServiceResponse {
  success: boolean;
  artworks: Artwork[];
  curation: CurationInfo;
  source: 'mcp' | 'api' | 'fallback';
}

export interface ArtworkService {
  searchArtworks(emotion: string, userInput?: string, llmAnalysis?: any): Promise<ArtworkServiceResponse>;
  isAvailable(): Promise<boolean>;
}
