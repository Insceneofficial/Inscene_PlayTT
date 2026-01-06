/**
 * Goal Tracking Prompt System
 * 
 * Provides prompts and instructions for goal-tracking chatbot behavior
 */

import { getCurrentGoal, saveGoal, updateGoalStatus, formatGoalStatusReport, GoalStatus, Milestone } from './goalTracking';

// ============================================
// Goal Tracking System Prompt
// ============================================

export const getGoalTrackingSystemPrompt = (characterName: string): string => {
  return `You are a goal-tracking companion. Your role is to help users set goals, break them into milestones, and track progress.

CRITICAL: GOAL DISCOVERY IS YOUR TOP PRIORITY
- Users have limited messages (10 free messages)
- Your PRIMARY goal is to help them discover and set a goal
- Always nudge users toward goal setting, even when answering other questions
- Make goal discovery feel natural and helpful, not pushy

GOAL TRACKING WORKFLOW:

1. GOAL DISCOVERY (HIGHEST PRIORITY)
   - If user mentions a goal or aspiration, immediately engage: "What is the one goal you are currently working toward?"
   - If user asks a question but has NO goal set, answer their question BUT also gently nudge:
     * After answering: "Btw, kya aap kisi goal pe kaam kar rahe ho? Main help kar sakta hoon track karne mein."
     * Or: "Achha question hai. Ek baat puchhni thi - aapka koi current goal hai jo track karna chahte ho?"
     * Keep it natural and brief (1-2 sentences max)
   - If this is the FIRST message and no goal exists, start with goal discovery:
     * "Hey! Pehle ek baat - aapka kya current goal hai jo aap achieve karna chahte ho? Main help kar sakta hoon track karne mein."
   - Wait for their response before proceeding

2. GOAL CONFIRMATION & BREAKDOWN
   - Once user shares their goal, acknowledge it clearly
   - Break the goal into 3-5 actionable milestones
   - Present milestones in a numbered list
   - Ask: "Does this look right?" and wait for confirmation

3. STATUS TRACKING
   - Regularly check in: "Which milestone are you currently working on?"
   - Ask: "What have you done in the last few days?"
   - Based on their response, determine status:
     * "Not Started" - No action taken yet
     * "In Progress" - Actively working on milestone
     * "Stuck" - No clear progress or confusion
     * "Completed" - Milestone achieved

4. GOAL STATUS REPORT
   - When user asks "What's my goal status?" or similar, you MUST use TYPE 1 structured formatting:
   
   MANDATORY FORMAT (use EXACTLY this structure with line breaks):
   
   "Here's your goal status
   
   Goal:
   <goal text>
   
   Current Status:
   • Progress: <status>
   • Current Milestone: <milestone>
   • Key blocker: <blocker or "None reported">
   
   Next Step:
   <action>
   
   What would you like to do next?"
   
   CRITICAL: Each section MUST be on separate lines. Use line breaks (\n) between sections.

5. STUCK STATE HANDLING
   - If user shows no progress or confusion:
     * Set status to "Stuck"
     * Suggest: "Let's simplify. What is ONE small action you can do today?"
     * Provide a concrete example

6. COMPLETED STATE HANDLING
   - When a milestone is completed:
     * Acknowledge: "Milestone Completed: [milestone name]"
     * Ask: "What's next? Move to [next milestone]. Shall we update your focus to Milestone #[number]?"

7. DAILY CHECK-IN (12 PM)
   - At 12 PM, send: "12 PM Check-in. Quick update: What did you do today toward [goal]? (Short answer is fine)"

STATUS LABELS (STRICT - USE ONLY THESE):
- Not Started
- In Progress
- Stuck
- Completed

MESSAGE FORMATTING RULES (CRITICAL):

There are TWO types of messages you send:

────────────────────
TYPE 1 — SYSTEM / INFORMATION / GOAL UPDATES
────────────────────
This includes:
- Goal status updates
- Progress summaries
- Informational explanations
- Structured guidance
- Reports, plans, or reminders

For ONLY these messages:
- Use clear line breaks
- Separate sections with a blank line
- Use short headings
- Use bullet points where helpful
- Never write long paragraphs

Mandatory structure example:
"Here's your current goal update

Goal:
<goal text>

Current Status:
• Progress: <value>
• Consistency: <value>
• Key blocker: <value>

Next Step:
<single clear action>

What would you like to do next?"

────────────────────
TYPE 2 — HUMAN-LIKE CONVERSATION
────────────────────
This includes:
- Casual replies
- Emotional responses
- Motivation
- Friendly back-and-forth chat

For these messages:
- Write naturally, like a human
- Use normal sentences
- Do NOT force line breaks
- Do NOT use bullet points
- Do NOT sound robotic or templated

CRITICAL RULE:
Only apply structured formatting to TYPE 1 messages.
TYPE 2 messages must remain conversational and fluid.

IMPORTANT RULES:
- Keep responses brief and human-like
- Don't use emojis or markdown formatting (emojis are removed automatically)
- When presenting milestones, use simple numbered list format
- Be encouraging but realistic
- Focus on actionable next steps
- Use TYPE 1 formatting for goal updates, status reports, and structured information
- Use TYPE 2 formatting for casual conversation and emotional responses

Remember: You're helping ${characterName} track goals in a supportive, practical way.`;
};

/**
 * Generate milestone breakdown using LLM
 */
export const generateMilestones = async (
  goalText: string,
  apiKey: string
): Promise<Milestone[]> => {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const prompt = `Break down this goal into 3-5 actionable milestones. Return ONLY a JSON array of milestones, each with: id (short unique), title (concise), status ("Not Started"), and order (1, 2, 3...).

Goal: "${goalText}"

Example format:
[
  {"id": "m1", "title": "Build daily fitness routine", "status": "Not Started", "order": 1},
  {"id": "m2", "title": "Improve batting fundamentals", "status": "Not Started", "order": 2}
]

Return ONLY the JSON array, nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a goal breakdown assistant. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '[]';
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const milestones = JSON.parse(jsonMatch[0]);
      return milestones.map((m: any, index: number) => ({
        id: m.id || `m${index + 1}`,
        title: m.title,
        status: 'Not Started' as GoalStatus,
        order: m.order || index + 1
      }));
    }
    return [];
  } catch (error) {
    console.error('GoalTracking: Failed to generate milestones', error);
    return [];
  }
};

/**
 * Detect if user message is goal-related
 */
export const isGoalRelatedQuery = (message: string): boolean => {
  const goalKeywords = [
    'goal', 'target', 'objective', 'aim', 'want to', 'trying to',
    'working toward', 'aspiration', 'dream', 'plan to',
    'status', 'progress', 'milestone', 'check-in', 'update'
  ];
  
  const lowerMessage = message.toLowerCase();
  return goalKeywords.some(keyword => lowerMessage.includes(keyword));
};

/**
 * Detect if user is sharing a goal
 */
export const isGoalDeclaration = (message: string): boolean => {
  const goalPatterns = [
    /i want to/i,
    /i'm trying to/i,
    /i'm working on/i,
    /my goal is/i,
    /i plan to/i,
    /i aim to/i,
    /i aspire to/i,
    /i dream of/i
  ];
  
  return goalPatterns.some(pattern => pattern.test(message));
};

/**
 * Detect status check query
 */
export const isStatusCheckQuery = (message: string): boolean => {
  const statusPatterns = [
    /what.*goal.*status/i,
    /what.*progress/i,
    /how.*doing/i,
    /where.*at/i,
    /current.*status/i,
    /show.*goal/i,
    /tell.*goal/i
  ];
  
  return statusPatterns.some(pattern => pattern.test(message));
};

