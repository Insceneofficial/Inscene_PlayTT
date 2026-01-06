# Prompt Versioning Implementation

## Overview
This implementation adds production-grade prompt versioning to ensure users always get the latest character prompts without requiring browser storage clearing.

## Changes Summary

### 1. Character Profiles (`lib/characters.ts`)
- ✅ Added `promptVersion: string` to `CharacterProfile` interface
- ✅ Added `promptVersion: "v2.0"` to all character profiles (Priyank, Arzoo, Debu, Anish, Chirag)
- ✅ Added `getCharacterPromptVersion(name: string)` helper function

### 2. Database Schema (`supabase_migration_add_prompt_version.sql`)
- ✅ Added `prompt_version TEXT` column to `chat_sessions` table
- ✅ Added index on `(character_name, prompt_version)` for fast lookups
- ✅ Existing rows will have `NULL` (treated as legacy v1.0)

### 3. Chat Storage (`lib/chatStorage.ts`)
- ✅ Updated `loadChatHistory()` to return `{ messages, promptVersion }`
- ✅ Queries `chat_sessions` to get the prompt version from the most recent session
- ✅ Updated `loadAllChatHistories()` to include prompt version tracking

### 4. Analytics (`lib/analytics.ts`)
- ✅ Added `promptVersion?: string` to `ChatSessionData` interface
- ✅ Updated `trackChatStart()` to store `prompt_version` in database

### 5. Chat Panel (`components/ChatPanel.tsx`)
- ✅ Imports `getCharacterPromptVersion` from characters
- ✅ On chat load, compares stored prompt version vs current prompt version
- ✅ If mismatch detected: starts new session with latest prompt (doesn't load old messages)
- ✅ If versions match: loads existing chat history as before
- ✅ Always passes current prompt version to `trackChatStart()`

## How It Works

### New Chat Flow
1. User starts a new chat
2. `getCharacterPromptVersion(character)` returns current version (e.g., "v2.0")
3. `trackChatStart()` stores this version in `chat_sessions.prompt_version`
4. Chat proceeds with latest system prompt

### Existing Chat Resume Flow
1. User opens existing chat
2. `loadChatHistory()` retrieves messages and stored prompt version
3. Compares stored version vs current version:
   - **Match**: Loads existing messages (old behavior continues)
   - **Mismatch**: Starts fresh with new greeting (new session with latest prompt)

### Version Mismatch Detection
```typescript
const currentPromptVersion = getCharacterPromptVersion(character);
const { messages, promptVersion: storedPromptVersion } = await loadChatHistory(character);

if (storedPromptVersion && storedPromptVersion !== currentPromptVersion) {
  // Start new session - don't load old messages
  // Old chat history remains in DB but not displayed
}
```

## Database Migration

Run the migration:
```sql
-- Execute: supabase_migration_add_prompt_version.sql
```

This adds:
- `prompt_version TEXT` column to `chat_sessions`
- Index for performance
- Backward compatible (NULL = legacy v1.0)

## Updating Prompt Versions

When updating a character prompt:

1. **Update the prompt** in `lib/characters.ts`
2. **Increment `promptVersion`** (e.g., "v2.0" → "v2.1")
3. **Deploy** - users will automatically get new version on next chat

Example:
```typescript
Debu: {
  name: "Debu",
  promptVersion: "v2.1", // ← Increment this
  // ... rest of profile
}
```

## Benefits

✅ **No user action required** - automatic migration  
✅ **Old chats preserved** - existing conversations continue with old behavior  
✅ **New chats always fresh** - latest prompt version guaranteed  
✅ **Production-safe** - backward compatible, no breaking changes  
✅ **Scalable** - works for any number of prompt updates  

## Testing Checklist

- [ ] New chat uses latest prompt version
- [ ] Existing chat with matching version loads correctly
- [ ] Existing chat with mismatched version starts fresh
- [ ] Prompt version stored in database
- [ ] No errors in console
- [ ] Old chats still accessible (not deleted)

## Notes

- Old chat messages remain in `chat_messages` table (not deleted)
- Only the display behavior changes (new session vs resume)
- Users can still access old chats through chat history if needed
- Prompt version is per-character (each character has independent versioning)

