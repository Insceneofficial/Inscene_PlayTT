# Chat Feature Debugging Guide

## Problem Summary
The chat feature was failing with network errors on Vercel production. The issue was that the app was making direct OpenAI API calls from the browser, which can fail due to:
- CORS issues
- Network errors
- API key exposure in client bundle
- Environment variable issues at build time

## Solution Implemented
1. **Created API Route**: `/api/chat.ts` - A Vercel serverless function that proxies OpenAI requests
2. **Updated Frontend**: Modified `ChatPanel.tsx` to use the API route instead of direct OpenAI calls
3. **Removed Client-Side OpenAI**: Removed all direct OpenAI client initialization from the browser

## Testing Locally

### Option 1: Using Vercel CLI (Recommended)
This is the best way to test locally as it matches production exactly:

1. Install Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. Set up environment variables:
   Create a `.env.local` file in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. Run the development server:
   ```bash
   vercel dev
   ```
   
   This will:
   - Start the Vite dev server for the frontend
   - Handle API routes at `/api/*`
   - Use environment variables from `.env.local`

4. Open your browser to the URL shown (usually `http://localhost:3000`)

### Option 2: Using Vite Dev Server (Limited)
If you want to use `npm run dev` with Vite, the API routes won't work directly. You have two options:

**A. Test frontend only** (API calls will fail, but you can test UI):
   ```bash
   npm run dev
   ```

**B. Use a proxy** (requires additional setup - not recommended)

## Testing on Production (Vercel)

1. **Verify Environment Variable**:
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Ensure `OPENAI_API_KEY` is set for Production, Preview, and Development environments
   - The value should start with `sk-` (OpenAI API key format)

2. **Redeploy**:
   - Push your changes to GitHub
   - Vercel will automatically redeploy
   - Or manually trigger a redeploy from the Vercel dashboard

3. **Check Vercel Logs**:
   - Go to your Vercel project → Deployments
   - Click on the latest deployment
   - Go to the "Functions" tab to see API route logs
   - Check for any errors related to `/api/chat`

## Debugging Steps

### 1. Check if API Route is Being Hit
- Open browser DevTools → Network tab
- Send a chat message
- Look for a request to `/api/chat`
- Check the request/response details

### 2. Check Environment Variables
**Local (Vercel CLI)**:
```bash
vercel env ls
```

**Production (Vercel Dashboard)**:
- Settings → Environment Variables
- Verify `OPENAI_API_KEY` exists and is correct

### 3. Check API Route Logs
**Local (Vercel CLI)**:
- Logs will appear in the terminal where `vercel dev` is running

**Production (Vercel Dashboard)**:
- Deployments → Latest Deployment → Functions → `/api/chat`
- Look for error messages or stack traces

### 4. Test API Route Directly
You can test the API route directly using curl:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "model": "gpt-4o-mini"
  }'
```

Replace `localhost:3000` with your Vercel URL for production testing.

## Common Issues

### Issue: "Network error" or "Failed to fetch"
**Possible causes**:
1. API route not deployed correctly
2. CORS issues (should be fixed with our implementation)
3. Environment variable not set

**Solution**:
- Check Vercel logs for the API route
- Verify `OPENAI_API_KEY` is set in Vercel
- Check browser console for detailed error messages

### Issue: "Server configuration error: OpenAI API key is missing"
**Solution**:
- Set `OPENAI_API_KEY` in Vercel Environment Variables
- Redeploy after setting the variable

### Issue: API route returns 404
**Solution**:
- Ensure `vercel.json` includes the API route rewrite
- Check that `api/chat.ts` exists in the project root
- Redeploy to Vercel

### Issue: Works locally but not on Vercel
**Solution**:
- Verify environment variable is set for "Production" environment in Vercel
- Check that the API route file is committed to Git
- Review Vercel build logs for any errors

## Files Changed

1. **Created**: `api/chat.ts` - Serverless API route
2. **Modified**: `components/ChatPanel.tsx` - Updated to use API route
3. **Modified**: `vercel.json` - Added API route rewrite rule
4. **Modified**: `package.json` - Added `@vercel/node` dev dependency

## Next Steps

1. Test locally using `vercel dev`
2. Verify chat works end-to-end
3. Push changes to GitHub
4. Monitor Vercel deployment
5. Test on production URL
6. Check Vercel logs if issues persist
