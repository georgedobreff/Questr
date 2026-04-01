# Social & Character UX

This document provides a comprehensive, code-level breakdown of the player identity and community systems in Questr, explaining how character progression is visualized and how social competition is facilitated.

---

## Part 1: The Character Sheet (`/character`)

The Character page is the most data-intensive page in the application, aggregating information from across the entire database to create a unified profile.

### 1. Data Aggregation Strategy
To ensure performance, the page uses a massive parallel fetch strategy:
- **6-way Fetch:** Retrieves profile metadata, equipped items (gear), user inventory (available items), plan-specific stats, the global achievement catalog, and the user's specific unlocks in a single `Promise.all` block.
- **Filtering:** It explicitly filters out pet consumables from the main character inventory to maintain clear separation of concerns.

### 2. Client-Side Stat Calculation
The page implements a robust calculation engine to determine the user's "Final Stats":
- **Base Stats:** Loads the AI-generated stats for the current plan (e.g., "Focus: 10").
- **Buff Aggregation:** Iterates through all `equipped_items`, parses their `stat_buffs` JSONB field, and sums the values.
- **Visualization:** Displays the result as `Base + Buff` (e.g., "12 (+2)"), using green for positive buffs and red for negative ones.

### 3. Achievement Visualization
- **Dynamic Sorting:** The UI automatically elevates unlocked achievements to the top of the list, providing instant gratification.
- **Catalog Map:** It uses the master `achievements` table to display potential goals, encouraging long-term engagement.

---

## Part 2: The Global Leaderboard (`/leaderboard`)

The Leaderboard provides a secure and high-performance social layer.

### 1. Secure Data Access
The page utilizes the `get_leaderboard` RPC documented in `deep-dive-character-and-stats.md`.
- **Privacy First:** This ensures the frontend only ever receives the public-facing fields (`full_name`, `xp`, `level`) and never sensitive account details.
- **Dual Rankings:** The UI provides a tabbed interface to switch between "Most Experienced" (XP) and "Wealthiest" (Coins) views.

### 2. User-Centric UI
To provide immediate context, the component compares every row ID against the current session ID:
- **Highlighting:** The current user's row is styled with a distinct background (`bg-primary/10`) and border, allowing them to find their rank instantly in a list of 50.
- **Rank Icons:** The top three pathfinders receive special honors (Crown, Silver Medal, Bronze Medal).

---

## Part 3: Character Diorama

The `/character` page uses a unique presentation for the 3D avatar.
- **`CharacterEnvironment`**: Unlike the simple selector during onboarding, the profile diorama wraps the avatar in a custom environment component that adds trees, grass, and stylized lighting.
- **Interaction:** The viewer is configured with `enableControls={true}`, allowing the user to rotate and zoom into their character to admire their equipped gear.

---

## Part 4: Technical Invariants

- **Auto-Sync:** On mount, the Character page calls the `check_achievements` RPC. This ensures that any badges earned in the background (e.g., through time-based or mission-based logic) are calculated and rewarded the moment the user views their profile.
- **Responsive Layout:** The character sheet uses a responsive grid that moves the 3D avatar and basic stats to the top on mobile, while keeping the complex inventory and achievement lists accessible below.
