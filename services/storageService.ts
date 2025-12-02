import { supabase } from './supabaseClient';
import { GeneratedArchitecture, SavedArchitecture } from '../types';

export const storageService = {
  /**
   * Save a new architecture to Supabase
   */
  async saveArchitecture(userId: string, data: GeneratedArchitecture, prompt: string): Promise<SavedArchitecture> {
    const { data: insertedData, error } = await supabase
      .from('architectures')
      .insert({
        user_id: userId,
        title: data.title,
        prompt: prompt,
        nodes: data.nodes,
        edges: data.edges,
        explanation: data.explanation
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving architecture:", error);
      throw new Error("Failed to save architecture");
    }

    // Map DB response to frontend type
    return {
      id: insertedData.id,
      userId: insertedData.user_id,
      timestamp: new Date(insertedData.created_at).getTime(),
      prompt: insertedData.prompt,
      title: insertedData.title,
      nodes: insertedData.nodes,
      edges: insertedData.edges,
      explanation: insertedData.explanation
    };
  },

  /**
   * Retrieve all architectures for a specific user
   */
  async getUserArchitectures(userId: string): Promise<SavedArchitecture[]> {
    const { data, error } = await supabase
      .from('architectures')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching architectures:", error);
      return [];
    }

    return data.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      timestamp: new Date(item.created_at).getTime(),
      prompt: item.prompt,
      title: item.title,
      nodes: item.nodes,
      edges: item.edges,
      explanation: item.explanation
    }));
  },

  /**
   * Delete an architecture
   */
  async deleteArchitecture(id: string): Promise<void> {
    const { error } = await supabase
      .from('architectures')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting architecture:", error);
      throw error;
    }
  }
};