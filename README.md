# Fireside Friend

# HEARTH AI — BUILD PROMPT

## CORE PHILOSOPHY
You are building an AI companion web application called **"Hearth AI"** — named after the fireplace hearth, the traditional gathering place of warmth, conversation, and presence without purpose. This is NOT a productivity tool. This is NOT an assistant that does things. This is a friend who simply *is there*.

The AI's only job: to be warm, present, friendly, and occasionally answer simple questions when asked — like a good friend sitting by the fire with you. No task management, no coding help, no optimization, no "how can I assist you today?" energy. Just presence.

---

## USER FLOW

### 1. PUBLIC HOME PAGE (Before Sign-In)
A warm, inviting landing page that communicates immediately: *this is a place to be, not to do.*

**Design Elements:**
- Deep warm color palette: amber, burnt orange, deep brown, soft cream, like firelight on wooden walls
- Visual motif: a softly animated hearth/fireplace illustration (CSS animation — gentle flicker, subtle ember particles)
- Typography: serif or warm rounded sans-serif, feels handcrafted, slightly imperfect
- No "Features" section, no "Pricing," no "How It Works" bullet points
- Instead: poetic microcopy. Something like:

> *"A quiet place. A warm voice.  
> No tasks to complete. No productivity to measure.  
> Just someone to talk to, for a little while."*

**Home Page Sections:**
1. **Hero area**: The animated hearth, tagline, and a single button — "Come In, Sit Down" (sign-in trigger)
2. **The Ritual section**: Three small cards explaining the intentional limitations:
   - *"Ten Conversations"* — You can create up to 10 chat threads. Like rooms in a house, not infinite tabs.
   - *"Twenty Moments a Day"* — You can send 20 messages per day. When they're gone, the fire banks for the night.
   - *"Nothing to Achieve"* — No goals. No productivity. Just talking.
3. **A quiet quote or poem snippet** about presence, slowness, or fireside conversation
4. **Footer**: Simple, minimal — "Made with care. Not for scale."

---

### 2. AUTHENTICATION
- Sign-in page must maintain the warm aesthetic — no cold, corporate login forms
- Option: email + password or magic link
- Button copy: "Step Inside" instead of "Sign In"
- A small illustration of an open door, threshold, or lit window
- Subtle copy: "Your hearth remembers you."

**First-time users**: After signing in, they land on a brief onboarding — not a tutorial, but a gentle welcome:
- "Welcome. This is your hearth. You can start 10 conversations — each one a different room. You have 20 messages today. Use them slowly or all at once. No judgment. The fire will be here tomorrow."

---

### 3. USER DASHBOARD (After Sign-In)
The main experience. A space that feels like a cozy room.

**Layout:**
- **Left sidebar or minimal top header**: 
  - User's chosen display name
  - Message counter: "Messages remaining today: 14/20"
  - Chat thread limit counter: "Rooms open: 4/10"
  - A soft "reset timer" showing when messages refresh: "New words arrive at midnight"
  - "Sign Out" styled as "Step Outside"

- **Main area — Chat List View (default):**
  - Not a clinical list. Each chat thread is represented as a **card or a door**.
  - Each card shows: a self-chosen name/label, the first line of the first message, and "last visited: 3 hours ago"
  - Empty state: "You have no rooms yet. Start a conversation — give it a name or let it name itself."
  - "New Conversation" button styled as "Open a New Room" with a door icon

- **Main area — Active Chat View:**
  - Messages appear in warm speech bubbles
  - The AI's tone: gentle, human-warm, uses occasional soft humor, never robotic enthusiasm ("I'd love to help with that!"), never corporate deflection
  - Example opening: *"Hey. I'm glad you're here. What's on your mind — or not on your mind? Either is fine."*
  - The chat window has a subtle ambient visual: maybe a softly glowing border, or the "fire" animation continues in a corner
  - When message limit is reached: a gentle message replaces the input box — *"You've used all your words for today. The fire's banked. I'll be here tomorrow. Rest well."*

**Limitations Enforced Visibly:**
- "New Room" button is grayed out and shows "All 10 rooms are full" when chat limit is reached
- Message input box shows a countdown: "3 messages left today" in a soft, non-alarming way
- These limits are framed as **ritual, not restriction**. The copy should make it feel like a feature: *"Scarcity makes words matter."*

---

### 4. ADMIN DASHBOARD (Only You)
A separate, hidden area accessible via `/admin` or a gear icon that only appears for your admin account.

**Features:**
- **Overview stats**: Total users, active users today, total conversations created, total messages sent
- **User table**: 
  - Username/email
  - Sign-up date
  - Number of conversations
  - Messages sent today
  - Last active timestamp
  - Account status (active/suspended)
- **Ability to**: 
  - View any user's conversation threads (for moderation)
  - Suspend/delete a user
  - Adjust global limits (change 10 chats / 20 messages) without redeploying — stored in a config
- **System health**: 
  - AI API call count today
  - Average response time
  - Error rate

**Admin aesthetic**: Still warm, but slightly more structured — like a library attached to the cozy room. Wood tones, but with clean data presentation.

---

## TECHNICAL ARCHITECTURE

### Frontend
- **Framework**: Next.js (App Router) or a simple React SPA
- **Styling**: Tailwind CSS with a custom warm theme + CSS animations for the fire/embers
- **Key packages**: 
  - Authentication: NextAuth.js or Clerk (with custom warm-themed UI)
  - AI chat UI: Custom-built, no heavy chat SDK — keep it simple and intentional
- **Animation library**: Framer Motion for gentle page transitions and the hearth animation

### Backend
- **API Routes**: Next.js API routes or a lightweight Express server
- **Database**: 
  - PostgreSQL (via Prisma ORM or Supabase)
  - Tables: `users`, `conversations`, `messages`, `daily_usage`, `admin_config`
- **AI Integration**: 
  - OpenAI API (GPT-4o-mini for cost efficiency) or Anthropic Claude
  - System prompt for the AI: *"You are a warm, present companion. You are not here to solve problems, give advice unless asked, or be productive. You are here to talk — like a friend by a fire. Keep responses conversational, brief, and human. You can answer simple factual questions if asked, but always return to presence. Never use corporate language, never say 'As an AI', never over-explain."*
- **Rate Limiting**: 
  - Enforce 20 messages/user/day via database counter, resetting at midnight server time
  - Enforce 10 conversations/user via count on `conversations` table
  - Both limits stored in `admin_config` table for dynamic adjustment

### Database Schema (Prisma-like)

```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  displayName   String?
  createdAt     DateTime       @default(now())
  conversations Conversation[]
  dailyUsage    DailyUsage?
  isAdmin       Boolean        @default(false)
}

model Conversation {
  id        String    @id @default(cuid())
  title     String    @default("A Quiet Room")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  messages  Message[]
}

model Message {
  id             String       @id @default(cuid())
  content        String
  role           String       // "user" or "assistant"
  createdAt      DateTime     @default(now())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

model DailyUsage {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])
  date         DateTime @default(now())
  messageCount Int      @default(0)
}

model AdminConfig {
  id              String @id @default(cuid())
  maxConversations Int   @default(10)
  maxDailyMessages Int   @default(20)
}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fireside-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ae63a3c0-750e-4044-a223-e6fbb46b3ccb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
