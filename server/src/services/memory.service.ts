import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Memory Entry stored in ChromaDB
 */
export interface MemoryEntry {
  id: string;
  studentId: string;
  question: string;
  answer: string;
  lessonId?: string;
  lessonTitle?: string;
  subject?: string;
  timestamp: string;
  concepts?: string[];
}

/**
 * Retrieved memory for RAG injection
 */
export interface RetrievedMemory {
  id: string;
  question: string;
  answer: string;
  lessonTitle?: string;
  subject?: string;
  similarity: number;
  timestamp: string;
}

/**
 * Memory Service
 *
 * Implements RAG (Retrieval Augmented Generation) with ChromaDB for
 * persistent long-term memory at the student level.
 *
 * Features:
 * - Isolated collections per student (student_memory_{student_id})
 * - Ollama embeddings via qwen3-embedding model
 * - Similarity search for relevant past interactions
 * - SQLite-ChromaDB synchronization
 */
class MemoryService {
  private client: ChromaClient | null = null;
  private initialized: boolean = false;
  private embeddingModel: string = 'qwen3-embedding';

  /**
   * Initialize the ChromaDB client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Connect to ChromaDB (default: localhost:8000)
      const chromaHost = process.env.CHROMA_HOST || 'localhost';
      const chromaPort = process.env.CHROMA_PORT || '8000';

      this.client = new ChromaClient({
        path: `http://${chromaHost}:${chromaPort}`,
      });

      // Test connection by listing collections
      await this.client.listCollections();

      this.initialized = true;
      console.log(`[Memory] ChromaDB connected at ${chromaHost}:${chromaPort}`);
    } catch (error) {
      console.warn('[Memory] ChromaDB not available - memory features disabled:', error);
      this.client = null;
    }
  }

  /**
   * Check if memory service is available
   */
  isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Get or create a student's memory collection
   * Collection name format: student_memory_{student_id}
   */
  private async getStudentCollection(studentId: string): Promise<Collection | null> {
    if (!this.client) return null;

    const collectionName = `student_memory_${studentId.replace(/-/g, '_')}`;

    try {
      // Try to get existing collection
      const collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: {
          studentId,
          createdAt: new Date().toISOString(),
        },
      });

      return collection;
    } catch (error) {
      console.error(`[Memory] Failed to get collection for student ${studentId}:`, error);
      return null;
    }
  }

  /**
   * Initialize a student's memory collection
   * Called when a new student profile is created
   */
  async initializeStudentMemory(studentId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      console.log('[Memory] Service not available, skipping initialization');
      return false;
    }

    try {
      const collection = await this.getStudentCollection(studentId);
      if (collection) {
        console.log(`[Memory] Initialized collection for student ${studentId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[Memory] Failed to initialize memory for student ${studentId}:`, error);
      return false;
    }
  }

  /**
   * Delete a student's memory collection
   * Called when a student profile is deleted (synchronization)
   */
  async deleteStudentMemory(studentId: string): Promise<boolean> {
    if (!this.client) return false;

    const collectionName = `student_memory_${studentId.replace(/-/g, '_')}`;

    try {
      await this.client.deleteCollection({ name: collectionName });
      console.log(`[Memory] Deleted collection for student ${studentId}`);
      return true;
    } catch (error) {
      // Collection might not exist, which is fine
      console.log(`[Memory] Collection for student ${studentId} not found or already deleted`);
      return true;
    }
  }

  /**
   * Generate embeddings using Ollama
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const response = await fetch(`${config.ollama.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text,
        }),
      });

      if (!response.ok) {
        console.error('[Memory] Embedding generation failed:', response.statusText);
        return null;
      }

      const data = await response.json() as { embedding: number[] };
      return data.embedding;
    } catch (error) {
      console.error('[Memory] Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Store a Q&A interaction in the student's memory
   *
   * @param studentId - The student's user ID
   * @param question - The student's question
   * @param answer - The AI's response
   * @param metadata - Optional metadata (lessonId, subject, etc.)
   */
  async storeInteraction(
    studentId: string,
    question: string,
    answer: string,
    metadata?: {
      lessonId?: string;
      lessonTitle?: string;
      subject?: string;
      concepts?: string[];
    }
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const collection = await this.getStudentCollection(studentId);
      if (!collection) return false;

      // Create searchable text (combine question + key answer points)
      const searchableText = `${question}\n${answer.substring(0, 500)}`;

      // Generate embedding for the interaction
      const embedding = await this.generateEmbedding(searchableText);
      if (!embedding) {
        console.warn('[Memory] Failed to generate embedding, storing without vectors');
      }

      const id = uuidv4();
      const timestamp = new Date().toISOString();

      // Store in ChromaDB
      await collection.add({
        ids: [id],
        embeddings: embedding ? [embedding] : undefined,
        documents: [searchableText],
        metadatas: [{
          studentId,
          question,
          answer,
          lessonId: metadata?.lessonId || '',
          lessonTitle: metadata?.lessonTitle || '',
          subject: metadata?.subject || '',
          concepts: metadata?.concepts ? JSON.stringify(metadata.concepts) : '[]',
          timestamp,
        }],
      });

      console.log(`[Memory] Stored interaction for student ${studentId}: ${question.substring(0, 50)}...`);
      return true;
    } catch (error) {
      console.error('[Memory] Failed to store interaction:', error);
      return false;
    }
  }

  /**
   * Retrieve relevant memories for context injection (RAG)
   *
   * @param studentId - The student's user ID
   * @param query - The current question to find relevant context for
   * @param limit - Maximum number of memories to return (default: 3)
   */
  async retrieveRelevantMemories(
    studentId: string,
    query: string,
    limit: number = 3
  ): Promise<RetrievedMemory[]> {
    if (!this.isAvailable()) return [];

    try {
      const collection = await this.getStudentCollection(studentId);
      if (!collection) return [];

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        console.warn('[Memory] Failed to generate query embedding');
        return [];
      }

      // Search for similar past interactions
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
      });

      if (!results.ids || results.ids.length === 0 || results.ids[0].length === 0) {
        return [];
      }

      // Transform results to RetrievedMemory format
      const memories: RetrievedMemory[] = [];

      for (let i = 0; i < results.ids[0].length; i++) {
        const metadata = results.metadatas?.[0]?.[i] as Record<string, unknown> | undefined;
        const distance = results.distances?.[0]?.[i] ?? 1;

        // Convert distance to similarity (0-1 scale, higher is better)
        // ChromaDB uses L2 distance by default, so smaller is better
        const similarity = 1 / (1 + distance);

        // Only include if similarity is above threshold (0.3)
        if (similarity >= 0.3 && metadata) {
          memories.push({
            id: results.ids[0][i],
            question: String(metadata.question || ''),
            answer: String(metadata.answer || ''),
            lessonTitle: metadata.lessonTitle ? String(metadata.lessonTitle) : undefined,
            subject: metadata.subject ? String(metadata.subject) : undefined,
            similarity,
            timestamp: String(metadata.timestamp || ''),
          });
        }
      }

      console.log(`[Memory] Retrieved ${memories.length} relevant memories for query: ${query.substring(0, 50)}...`);
      return memories;
    } catch (error) {
      console.error('[Memory] Failed to retrieve memories:', error);
      return [];
    }
  }

  /**
   * Format retrieved memories for prompt injection
   * Returns a string suitable for adding to the system prompt
   */
  formatMemoriesForPrompt(memories: RetrievedMemory[]): string {
    if (memories.length === 0) return '';

    let prompt = `## MEMORIA CONVERSACIONAL (Interacciones Previas Relevantes)

Las siguientes son interacciones pasadas que pueden ser relevantes para la pregunta actual del estudiante:

`;

    for (let i = 0; i < memories.length; i++) {
      const mem = memories[i];
      const relevance = Math.round(mem.similarity * 100);

      prompt += `### Interaccion ${i + 1} (Relevancia: ${relevance}%)`;
      if (mem.lessonTitle) {
        prompt += ` - Leccion: ${mem.lessonTitle}`;
      }
      prompt += `\n`;
      prompt += `**Pregunta anterior**: ${mem.question}\n`;
      prompt += `**Tu respuesta**: ${mem.answer.substring(0, 300)}${mem.answer.length > 300 ? '...' : ''}\n\n`;
    }

    prompt += `---
**Instrucciones de uso de memoria**:
- Usa estas interacciones previas para mantener continuidad y evitar repeticion
- Si el estudiante pregunta algo que ya explicaste, referencia la explicacion anterior
- Si el estudiante vuelve a un tema, profundiza en lugar de repetir
- Nunca menciones explicitamente que estas "recordando" - integra naturalmente

`;

    return prompt;
  }

  /**
   * Get all memory IDs for a student (for synchronization checks)
   */
  async getStudentMemoryIds(studentId: string): Promise<string[]> {
    if (!this.isAvailable()) return [];

    try {
      const collection = await this.getStudentCollection(studentId);
      if (!collection) return [];

      const results = await collection.get({
        include: [],
      });

      return results.ids || [];
    } catch (error) {
      console.error(`[Memory] Failed to get memory IDs for student ${studentId}:`, error);
      return [];
    }
  }

  /**
   * Get memory statistics for a student
   */
  async getStudentMemoryStats(studentId: string): Promise<{
    totalMemories: number;
    oldestMemory?: string;
    newestMemory?: string;
  }> {
    if (!this.isAvailable()) {
      return { totalMemories: 0 };
    }

    try {
      const collection = await this.getStudentCollection(studentId);
      if (!collection) return { totalMemories: 0 };

      const results = await collection.get({
        include: [IncludeEnum.Metadatas],
      });

      const timestamps = (results.metadatas || [])
        .map(m => m?.timestamp as string | undefined)
        .filter((t): t is string => !!t)
        .sort();

      return {
        totalMemories: results.ids.length,
        oldestMemory: timestamps[0],
        newestMemory: timestamps[timestamps.length - 1],
      };
    } catch (error) {
      console.error(`[Memory] Failed to get stats for student ${studentId}:`, error);
      return { totalMemories: 0 };
    }
  }

  /**
   * Verify synchronization between SQLite and ChromaDB
   * Called on startup to ensure consistency
   */
  async verifySynchronization(existingStudentIds: string[]): Promise<{
    inSync: boolean;
    orphanedCollections: string[];
    missingCollections: string[];
  }> {
    if (!this.client) {
      return { inSync: true, orphanedCollections: [], missingCollections: [] };
    }

    try {
      // Get all collections from ChromaDB
      // Note: In ChromaDB v1.x, listCollections() returns string[] (collection names)
      const collectionNames = await this.client.listCollections();
      const chromaStudentIds = new Set<string>();

      for (const colName of collectionNames) {
        const name = typeof colName === 'string' ? colName : (colName as { name: string }).name;
        if (name.startsWith('student_memory_')) {
          // Extract student ID from collection name
          const studentId = name.replace('student_memory_', '').replace(/_/g, '-');
          chromaStudentIds.add(studentId);
        }
      }

      const sqliteStudentIds = new Set(existingStudentIds);

      // Find orphaned collections (in ChromaDB but not in SQLite)
      const orphanedCollections = [...chromaStudentIds].filter(id => !sqliteStudentIds.has(id));

      // Find missing collections (in SQLite but not in ChromaDB)
      const missingCollections = [...sqliteStudentIds].filter(id => !chromaStudentIds.has(id));

      const inSync = orphanedCollections.length === 0 && missingCollections.length === 0;

      if (!inSync) {
        console.warn(`[Memory] Synchronization check failed:`);
        if (orphanedCollections.length > 0) {
          console.warn(`  - Orphaned collections: ${orphanedCollections.join(', ')}`);
        }
        if (missingCollections.length > 0) {
          console.warn(`  - Missing collections: ${missingCollections.join(', ')}`);
        }
      } else {
        console.log('[Memory] SQLite-ChromaDB synchronization verified');
      }

      return { inSync, orphanedCollections, missingCollections };
    } catch (error) {
      console.error('[Memory] Failed to verify synchronization:', error);
      return { inSync: false, orphanedCollections: [], missingCollections: [] };
    }
  }

  /**
   * Clean up orphaned collections
   */
  async cleanOrphanedCollections(orphanedIds: string[]): Promise<number> {
    let cleaned = 0;

    for (const studentId of orphanedIds) {
      if (await this.deleteStudentMemory(studentId)) {
        cleaned++;
      }
    }

    console.log(`[Memory] Cleaned ${cleaned} orphaned collections`);
    return cleaned;
  }

  /**
   * Reset all memory for a student (utility function)
   */
  async resetStudentMemory(studentId: string): Promise<boolean> {
    const deleted = await this.deleteStudentMemory(studentId);
    if (deleted) {
      return await this.initializeStudentMemory(studentId);
    }
    return false;
  }

  /**
   * Reset ALL memory collections (DESTRUCTIVE - use with caution)
   */
  async resetAllMemory(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const collectionNames = await this.client.listCollections();
      let deletedCount = 0;

      for (const colName of collectionNames) {
        const name = typeof colName === 'string' ? colName : (colName as { name: string }).name;
        if (name.startsWith('student_memory_')) {
          await this.client.deleteCollection({ name });
          deletedCount++;
        }
      }

      console.log(`[Memory] Reset all memory - deleted ${deletedCount} collections`);
      return true;
    } catch (error) {
      console.error('[Memory] Failed to reset all memory:', error);
      return false;
    }
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
