
export interface ChatMessage {
    role: "user" | "model";
    parts: Array<{ text: string }>;
}

export interface ChatRequestBody {
    query: string;
    history?: ChatMessage[];
}

export interface StreamResponse {
    text: string;
}

export interface AddDocumentRequestBody {
    content: string;
    originalContent: string;
    metadata?: Record<string, any>;
}
