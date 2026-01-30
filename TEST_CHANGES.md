# Testing the Usage Limits Implementation

## Quick Test Steps

1. **Clear localStorage to see sign-up prompt:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run: `localStorage.removeItem('inscene_signup_prompt_shown')`
   - Refresh the page
   - You should see the sign-up prompt modal

2. **Test Guest Episode Restriction:**
   - As a guest user, try to navigate to Episode 2 or higher
   - You should see the mandatory sign-in modal

3. **Test Episode 1 Completion (Guest):**
   - As a guest, complete Episode 1
   - After completion, you should see the mandatory sign-in modal

4. **Test Chat Message Limit:**
   - Sign in as an authenticated user
   - Send 5 chat messages
   - On the 6th message, you should see the waitlist modal with "Message limit reached"

5. **Test Episode Limit:**
   - Sign in as an authenticated user
   - Complete 3 episodes
   - After the 3rd completion, you should see the waitlist modal with "Episode limit reached"

## Debug Console Commands

Check if sign-up prompt flag is set:
```javascript
localStorage.getItem('inscene_signup_prompt_shown')
```

Clear sign-up prompt flag:
```javascript
localStorage.removeItem('inscene_signup_prompt_shown')
```

Check authentication status:
```javascript
localStorage.getItem('inscene_google_user')
```

## Common Issues

- If sign-up prompt doesn't show: Clear the localStorage flag (see above)
- If changes don't appear: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- If dev server errors: Stop and restart `npm run dev`
