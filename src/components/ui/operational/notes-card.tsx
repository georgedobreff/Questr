'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, StickyNote } from 'lucide-react';
import { createNote, updateNote, deleteNote, UserNote } from '@/app/actions/note-actions';
import { toast } from 'sonner';

interface NotesCardProps {
    notes: UserNote[];
}

export function NotesCard({ notes }: NotesCardProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [newNote, setNewNote] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');

    const handleCreateNote = () => {
        if (!newNote.trim()) return;
        startTransition(async () => {
            const result = await createNote(newNote);
            if (result.success) {
                setNewNote('');
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to create note');
            }
        });
    };

    const handleUpdateNote = (noteId: string) => {
        if (!editingContent.trim()) return;
        startTransition(async () => {
            const result = await updateNote(noteId, editingContent);
            if (result.success) {
                setEditingNoteId(null);
                setEditingContent('');
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to update note');
            }
        });
    };

    const handleDeleteNote = (noteId: string) => {
        startTransition(async () => {
            const result = await deleteNote(noteId);
            if (result.success) {
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to delete note');
            }
        });
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <StickyNote className="w-5 h-5 text-primary" />
                    Personal Notes
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Write a note..."
                            className="min-h-[60px] text-sm resize-none"
                            maxLength={1000}
                        />
                        <Button
                            size="icon"
                            onClick={handleCreateNote}
                            disabled={isPending || !newNote.trim()}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                        {notes.length > 0 ? (
                            notes.map((note) => (
                                <div
                                    key={note.id}
                                    className="p-3 rounded-lg border bg-card group"
                                >
                                    {editingNoteId === note.id ? (
                                        <div className="space-y-2">
                                            <Textarea
                                                value={editingContent}
                                                onChange={(e) => setEditingContent(e.target.value)}
                                                className="min-h-[60px] text-sm resize-none"
                                                maxLength={1000}
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleUpdateNote(note.id)}
                                                    disabled={isPending}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingNoteId(null);
                                                        setEditingContent('');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(note.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => {
                                                        setEditingNoteId(note.id);
                                                        setEditingContent(note.content);
                                                    }}
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    disabled={isPending}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No notes yet. Start writing!
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
