import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('[API] OPENAI_API_KEY is not set');
      return res.status(500).json({ 
        error: 'Server configuration error: OpenAI API key is missing',
        details: 'Please set OPENAI_API_KEY in Vercel environment variables'
      });
    }

    // Validate request body
    const { messages, model = 'gpt-4o-mini', tools, tool_choice = 'auto', temperature = 0.8 } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array is required and must not be empty' 
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Make the OpenAI API call
    const response = await openai.chat.completions.create({
      model,
      messages,
      ...(tools && { tools }),
      ...(tool_choice && { tool_choice }),
      temperature,
    });

    // Filter response content for inappropriate material
    if (response.choices && response.choices.length > 0) {
      const message = response.choices[0].message;
      if (message && message.content) {
        // List of forbidden terms and patterns
        const forbiddenTerms = [
          /\b(beta|bhai)\b/gi, // Casual/informal address terms - explicitly forbidden
          // Add more patterns as needed for obscene/vulgar content
        ];
        
        // Check if content contains forbidden terms
        const containsForbidden = forbiddenTerms.some(pattern => pattern.test(message.content));
        
        if (containsForbidden) {
          // Replace with safe, professional response
          message.content = "I'm here to help you with cricket coaching and fitness goals. How can I assist you today?";
          console.warn('[API] Filtered inappropriate content from AI response');
        }
      }
    }

    // Return the response
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('[API] OpenAI API error:', error);
    
    // Handle specific error types
    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: 'OpenAI API error',
        message: error.message,
        type: error.type,
        code: error.code,
      });
    }

    // Generic error response
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    });
  }
}
