'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GuildEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createGuildEvent, updateGuildEvent, deleteGuildEvent } from '@/app/actions/guild-actions';
import { toast } from 'sonner';
import { Calendar, Plus, Pencil, Trash2 } from 'lucide-react';

const formatMonth = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
const formatDay = (date: Date) => date.getDate().toString();
const formatDayTime = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long' }) + ', ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

interface EventsTabProps {
    guildId: string;
    events: GuildEvent[];
    isMaster: boolean;
}

export function EventsTab({ guildId, events, isMaster }: EventsTabProps) {
    const [isPending, startTransition] = useTransition();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<GuildEvent | null>(null);
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventDate, setEventDate] = useState('');

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setEventDate('');
        setEditingEvent(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setDialogOpen(true);
    };

    const openEditDialog = (event: GuildEvent) => {
        setEditingEvent(event);
        setTitle(event.title);
        setDescription(event.description || '');
        setEventDate(event.event_date.slice(0, 16));
        setDialogOpen(true);
    };

    const handleSubmit = () => {
        if (!title.trim() || !eventDate) {
            toast.error('Title and date are required');
            return;
        }

        startTransition(async () => {
            let result;
            if (editingEvent) {
                result = await updateGuildEvent(editingEvent.id, guildId, title, description || null, eventDate);
            } else {
                result = await createGuildEvent(guildId, title, description || null, eventDate);
            }

            if (result.success) {
                toast.success(editingEvent ? 'Event updated!' : 'Event created!');
                setDialogOpen(false);
                resetForm();
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to save event');
            }
        });
    };

    const handleDelete = (eventId: string) => {
        startTransition(async () => {
            const result = await deleteGuildEvent(eventId, guildId);
            if (result.success) {
                toast.success('Event deleted');
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to delete event');
            }
        });
    };

    const upcomingEvents = events.filter(e => new Date(e.event_date) >= new Date());
    const pastEvents = events.filter(e => new Date(e.event_date) < new Date());

    return (
        <div className="space-y-6">
            {isMaster && (
                <div className="flex justify-end">
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openCreateDialog}>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Event
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div>
                                    <label className="text-sm font-medium">Title</label>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Event title"
                                        maxLength={100}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Description (optional)</label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Event description"
                                        maxLength={500}
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Date & Time</label>
                                    <Input
                                        type="datetime-local"
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSubmit} disabled={isPending}>
                                        {editingEvent ? 'Save Changes' : 'Create Event'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
                <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <Calendar className="w-8 h-8 opacity-50" />
                    <p>No events scheduled</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {upcomingEvents.length > 0 && (
                        <div className="space-y-3">
                            {upcomingEvents.map(event => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    isMaster={isMaster}
                                    isPending={isPending}
                                    onEdit={() => openEditDialog(event)}
                                    onDelete={() => handleDelete(event.id)}
                                />
                            ))}
                        </div>
                    )}

                    {pastEvents.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-muted-foreground">Past Events</h4>
                            {pastEvents.map(event => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    isMaster={isMaster}
                                    isPending={isPending}
                                    onEdit={() => openEditDialog(event)}
                                    onDelete={() => handleDelete(event.id)}
                                    isPast
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface EventCardProps {
    event: GuildEvent;
    isMaster: boolean;
    isPending: boolean;
    onEdit: () => void;
    onDelete: () => void;
    isPast?: boolean;
}

function EventCard({ event, isMaster, isPending, onEdit, onDelete, isPast }: EventCardProps) {
    const eventDate = new Date(event.event_date);

    return (
        <div className={`rounded-lg border bg-card p-4 ${isPast ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 px-3 py-2 text-center min-w-[60px]">
                        <span className="text-xs font-medium text-primary uppercase">
                            {formatMonth(eventDate)}
                        </span>
                        <span className="text-2xl font-bold text-primary">
                            {formatDay(eventDate)}
                        </span>
                    </div>
                    <div>
                        <h4 className="font-semibold">{event.title}</h4>
                        {event.description && (
                            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                            {formatDayTime(eventDate)}
                        </p>
                    </div>
                </div>
                {isMaster && (
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={onEdit} disabled={isPending}>
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onDelete} disabled={isPending}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
