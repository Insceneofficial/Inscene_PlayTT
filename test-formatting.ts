/**
 * Quick test script to verify formatLLMResponse works correctly
 * Run with: npx tsx test-formatting.ts
 * Or: node --loader ts-node/esm test-formatting.ts
 */

import { formatLLMResponse } from './lib/formatLLMResponse.ts';

// Test case: The exact problematic text from the image
// Everything on one line without proper breaks
const testCase1 = `Here's your goal status: Goal: Onboard 3 influencers for Inscene Current Status: Progress: In Progress. Current Milestone: Identifying target influencers Key Blocker: None reported Next Step: Call 2 more influencers. What would you like to do next?`;

// Test case 2: Another single-line variant
const testCase2 = `Goal: Become a professional cricketer Current Status: Progress: In Progress. Current Milestone: Build daily fitness + stamina routine Key Blocker: None reported Next Step: Start playing at least 1 local match per week.`;

// Test case 3: Already formatted (should preserve structure)
const testCase3 = `Here's your goal status

Goal:
Become a professional cricketer

Current Status:
• Progress: In Progress
• Current Milestone: Build daily fitness + stamina routine
• Key blocker: None reported

Next Step:
Start playing at least 1 local match per week.

What would you like to do next?`;

console.log('='.repeat(80));
console.log('TEST 1: Single-line structured message (the problem case)');
console.log('='.repeat(80));
console.log('\nINPUT:');
console.log(testCase1);
console.log('\nOUTPUT:');
console.log(formatLLMResponse(testCase1));
console.log('\n');

console.log('='.repeat(80));
console.log('TEST 2: Another single-line variant');
console.log('='.repeat(80));
console.log('\nINPUT:');
console.log(testCase2);
console.log('\nOUTPUT:');
console.log(formatLLMResponse(testCase2));
console.log('\n');

console.log('='.repeat(80));
console.log('TEST 3: Already formatted (should preserve)');
console.log('='.repeat(80));
console.log('\nINPUT:');
console.log(testCase3);
console.log('\nOUTPUT:');
console.log(formatLLMResponse(testCase3));
console.log('\n');

// Verify the output has proper line breaks
const result1 = formatLLMResponse(testCase1);
const hasLineBreaks = result1.includes('\n');
const hasGoalSection = result1.includes('Goal:');
const hasCurrentStatus = result1.includes('Current Status:');
const hasNextStep = result1.includes('Next Step:');

console.log('='.repeat(80));
console.log('VERIFICATION:');
console.log('='.repeat(80));
console.log(`✓ Has line breaks: ${hasLineBreaks}`);
console.log(`✓ Has Goal section: ${hasGoalSection}`);
console.log(`✓ Has Current Status section: ${hasCurrentStatus}`);
console.log(`✓ Has Next Step section: ${hasNextStep}`);
console.log(`\n${hasLineBreaks && hasGoalSection && hasCurrentStatus && hasNextStep ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);



