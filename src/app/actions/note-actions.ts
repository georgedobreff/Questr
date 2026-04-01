'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface UserNote {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export async function getUserNotes(): Promise<UserNote[]> {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notes:', error);
        return [];
    }

    return data ?? [];
}

export async function createNote(content: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const trimmedContent = content.trim();
    if (!trimmedContent) return { success: false, error: 'Note cannot be empty' };
    if (trimmedContent.length > 1000) return { success: false, error: 'Note too long (max 1000 chars)' };

    const { error } = await supabase
        .from('user_notes')
        .insert({
            user_id: user.id,
            content: trimmedContent
        });

    if (error) {
        console.error('Error creating note:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true };
}

export async function updateNote(noteId: string, content: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const trimmedContent = content.trim();
    if (!trimmedContent) return { success: false, error: 'Note cannot be empty' };
    if (trimmedContent.length > 1000) return { success: false, error: 'Note too long (max 1000 chars)' };

    const { error } = await supabase
        .from('user_notes')
        .update({
            content: trimmedContent,
            updated_at: new Date().toISOString()
        })
        .eq('id', noteId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error updating note:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteNote(noteId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('user_notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting note:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true };
}
