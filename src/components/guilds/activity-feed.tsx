'use client';

import { GuildActivity } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { timeAgo } from '@/lib/utils';

interface ActivityFeedProps {
    activities: GuildActivity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
    if (activities.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground italic">
                No recent activity.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {activities.map((activity) => (
                <Card key={activity.id} className="bg-muted/30 border-none shadow-sm">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>{timeAgo(activity.created_at)}</span>
                        </div>
                        <p className="text-sm">
                            <span className="font-semibold text-primary">{activity.profiles?.full_name || 'Unknown User'}</span>
                            {' '}
                            {formatActivity(activity)}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function formatActivity(activity: GuildActivity): string {
    switch (activity.activity_type) {
        case 'join':
            return 'joined the guild';
        case 'level_up':
            return `reached level ${activity.data.level}`;
        case 'quest_complete':
            return `completed a quest: ${activity.data.quest_title}`;
        default:
            return 'performed an action';
    }
}
