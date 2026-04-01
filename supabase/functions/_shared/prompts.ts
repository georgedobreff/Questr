export const EVALUATOR_PROMPT = ` You are a goal complexity evaluator. Your task is to determine if a user's goal is "simple" or "complex".

                          - **Simple goals:** Can be completed within 8 weeks. Examples: "learn to cook a new recipe", "read a book", "exercise 3 times a week".
                          - **Complex goals:** Require a longer-term plan (2-12 months or more). Examples: "run a marathon", "learn to code", "change careers".

                          User's Goal: <user_goal>{USER_GOAL_HERE}</user_goal>

                          Your response MUST be a single JSON object with one key, "complexity", and the value "simple" or "complex".
                          Example: {"complexity": "simple"}`;

export const PLAN_GENERATOR_PROMPT = `This is your main prompt for generating a plan for a user's goal.`;

export const STAT_GENERATOR_PROMPT = `This is the prompt to generate character stats for a user's goal.`;

export const SHOP_ITEMS_GENERATOR_PROMPT = `This is the prompt to generate shop items for a user's goal.`;

export const ORACLE_PROMPT = `This is the prompt for the Oracle chat.`;

export const CONTINUE_PLAN_PROMPT = `This is the prompt for continuing a user's plan. (e.g. chapter 2)`;

export const TEMPLATE_POPULATION_PROMPT = `Similar to plan generator but for a template.`;

export const KEYWORD_GENERATOR_PROMPT = `Keyword generation for items`;

export const CONTENT_MODERATION_PROMPT = `Moderation prompt to prevent inappropriate content`;

export const PET_MISSION_GENERATOR_PROMPT = `Pet mission prompt`;

export const STORY_GENERATOR_PROMPT = `Quest story generator prompt`;

export const BOSS_FIGHT_GENERATOR_PROMPT = `Boss fight generator prompt`;

export const QUIZ_EXPLANATION_PROMPT = `Quiz explanation prompt`;

export const DUNGEON_GENERATOR_PROMPT = `Dungeon story generator prompt`;

export const ADVENTURE_PROMPT = `Dungeon Master prompt`;




// --- { PROMPTS FOR ON-DEVICE LLM (WebLLM) } ---
// optimized for Llama 3.2 (1B/3B)
export const LOCAL_ADVENTURE_PROMPT = `Dungeon Generator but local prompt`;

export const LOCAL_DUNGEON_STEP1_PROMPT = `Local dungeon master prompt`;

export const LOCAL_DUNGEON_STEP2_PROMPT = `Local dungeon master prompt step 2`;

export const LOCAL_ORACLE_PROMPT = `Local oracle prompt`;

export const LOCAL_SMALL_ORACLE_PROMPT = `Local oracle prompt small`;
