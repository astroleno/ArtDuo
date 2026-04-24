export interface Painting {
  id: string;
  title: string;
  artist: string;
  year: string;
  url: string;
  aspectRatio: 'portrait' | 'landscape' | 'square';
}

export interface AIAnalysis {
  description: string;
  mood: string;
  technique: string;
}