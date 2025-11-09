export interface Document {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface QAResponse {
  id: string;
  question: string;
  answer: string;
  citations: Array<{
    chunkId: string;
    documentId: string;
    content: string;
    score: any;
  }>;
}
