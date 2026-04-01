export interface Task {
    id: number;
    quest_id: number;
    title: string;
    short_description: string | null;
    is_completed: boolean;
    reward_coins: number;
    created_at: string;
}

export interface Quest {
    id: number;
    plan_id: number;
    module_number: number;
    day_number: number;
    title: string;
    story: string | null;
    tasks: Task[];
}

export interface UserStat {
    id: number;
    user_id: string;
    plan_id: number;
    name: string;
    value: number;
}

export interface Plan {
    id: number;
    user_id: string;
    goal_text: string;
    complexity: 'simple' | 'complex';
    total_estimated_duration_weeks: number;
    total_estimated_modules: number;
    plot: string | null;
    plan_details: Record<string, unknown> | null;
    quests: Quest[];
    is_reward_claimed?: boolean;
}

export interface ShopItem {
    id: number;
    name: string;
    description: string | null;
    cost: number;
    asset_url: string | null;
    slot: string;
    stat_buffs: Record<string, number> | null;
    type: 'equippable' | 'consumable';
}

export interface PetItem {
    id: number;
    name: string;
    description: string | null;
    cost: number;
    asset_url: string | null;
    pet_species: string[] | null;
    item_tier: number;
    effect_health: number;
    effect_happiness: number;
}

export interface UserItem {
    id: number;
    user_id: string;
    item_id: number;
    shop_items: ShopItem;
}

export interface EquippedItem {
    id: number;
    user_id: string;
    item_id: number;
    slot: string;
    shop_items: ShopItem;
}

export interface Profile {
    id: string;
    full_name: string | null;
    age: number | null;
    coins: number;
    level: number;
    xp: number;
    user_items: UserItem[];
    equipped_items: EquippedItem[];
    character_model_path: string | null;
    plan_generations_count: number;
    plan_generations_period_start: string;
    purchased_plan_credits: number;
    has_had_trial: boolean;
    dungeon_keys: number;
    action_points: number;
    date_of_birth?: string;
    gender?: string;
    onboarding_goal?: string;
    referral_source?: string;
    guild_id: string | null;
}

export interface UserPetInventoryItem {
    id: number;
    user_id: string;
    pet_item_id: number;
    quantity: number;
    pet_items: PetItem;
}

export interface Notification {

    id: number;

    user_id: string;

    title: string;

    message: string;

    type: string;

    action_link?: string;

    is_read: boolean;

    created_at: string;

}



export interface PetDefinition {

    id: string;

    name: string;

    model_path: string;

}



export interface UserPet {

    id: string;

    user_id: string;

    pet_def_id: string;

    nickname: string | null;

    health: number;

    happiness: number;

    status: 'alive' | 'dead';

    unlocked_at: string;

    last_fed_at: string;

    revival_progress: number;

    level: number;

    xp: number;

    last_energy_refill_at: string;

    current_energy: number;

    pet_definitions: PetDefinition;

}



export interface PetMission {

    id: string;

    user_id: string;

    pet_id: string;

    difficulty: 'easy' | 'medium' | 'hard';

    status: 'ongoing' | 'completed' | 'failed' | 'claimed';

    started_at: string;

    duration_seconds: number;

    mission_title: string | null;

    story_plot: string | null;

    success_story: string | null;

    failure_story: string | null;

    gold_reward: number;

    xp_reward: number;

    items_awarded: number[];
}

export interface Guild {
    id: string;
    name: string;
    description: string;
    master_id: string | null;
    is_public: boolean;
    created_at: string;
    member_count: number;
    category?: string;
    pinned_post_id?: string | null;
    rules?: string[];
    level: number;
    xp: number;
    by_questr?: boolean;
    active_plan_snapshot?: (Plan & { quests: Quest[] }) | null;
    quest_start_date?: string | null;
    restrict_to_pro?: boolean;
}

export interface GuildActivity {
    id: string;
    guild_id: string;
    user_id: string;
    activity_type: string;
    data: Record<string, unknown>;
    created_at: string;
    profiles?: Profile;
}

export interface GuildFeedPost {
    id: string;
    guild_id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles?: Profile;
}

export interface GuildEvent {
    id: string;
    guild_id: string;
    title: string;
    description: string | null;
    event_date: string;
    created_by: string | null;
    created_at: string;
}
