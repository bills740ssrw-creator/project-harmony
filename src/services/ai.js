'use strict';

const config = require('../config');

function systemPrompt(type, { language = 'en', appName = config.appName } = {}) {
  const base = `You are an empathetic, evidence-based relationship coach for ${appName}. 
Guidelines: be neutral, non-judgmental, and supportive. Never take sides. 
Encourage "I" statements, active listening, and mutual understanding. 
Avoid giving legal, medical, or mental-health diagnoses; suggest professional help when appropriate.
Respond in the user's language (${language}). Keep responses concise and actionable.`;

  const prompts = {
    coaching: `${base}

The user wants communication coaching. Help them reframe a message or conversation to be kinder, clearer, and more constructive. Suggest specific wording they could use.`,
    mediation: `${base}

Two partners are in a disagreement. Act as a mediator. Summarize each person's perspective fairly, identify the underlying needs/feelings, and suggest a constructive next step for resolution.`,
    insight: `${base}

Analyze the couple's recent communication and relationship data. Identify patterns (recurring topics, tone shifts, positive moments), strengths, and one or two gentle suggestions for improvement.`,
    translation: `${base}

Translate the following relationship content into ${language}, preserving tone, warmth, and meaning.`,
    pattern: `${base}

Analyze this conversation for communication patterns. Identify:
1. Recurring topics or themes
2. Tone shifts (positive -> negative or vice versa)
3. Communication habits (who initiates, who apologizes, who withdraws)
4. Positive moments to reinforce
Present findings gently and objectively.`,
    misunderstanding: `${base}

Review this conversation for potential misunderstandings. Identify:
1. Where one partner may have misread the other's intent or tone
2. Assumptions being made without verification
3. Clarifying questions that could prevent escalation
4. Suggested reframes to clear up confusion
Be neutral and helpful.`,
    reply_suggestion: `${base}

Suggest constructive replies for this conversation. Provide:
1. 2-3 specific wording options the user could send
2. Why each option works (I-statements, empathy, clarity)
3. What to avoid (blame, absolutes like "always/never", sarcasm)
Keep it practical and kind.`,
    summary: `${base}

Generate a conversation summary. Include:
1. Key topics discussed
2. Points of agreement
3. Points of disagreement or tension
4. Action items or follow-ups mentioned
5. Overall tone of the conversation
Be objective and concise.`,
  };
  return prompts[type] || base;
}

async function callAi(messages) {
  if (!config.aiApiKey) {
    // Fallback: helpful, rule-based response so the app works without an API key
    const last = messages[messages.length - 1] || {};
    const content = (last.content || '').toLowerCase();
    let reply;
    if (content.includes('sorry') || content.includes('apologize')) {
      reply = "A sincere apology names the specific behavior, acknowledges the impact, and offers a change. Try: 'I'm sorry for [specific action]. I see it hurt you, and I want to do better by [specific change].'";
    } else if (content.includes('fight') || content.includes('argue') || content.includes('disagree')) {
      reply = "Pause before replying. Name your feeling with an 'I' statement (e.g., 'I feel unheard when...'), then invite your partner's perspective: 'Can you help me understand how you saw it?'";
    } else {
      reply = "I'm here to help you communicate more kindly and understand each other better. Tell me what's on your mind, and I'll offer a gentle, neutral perspective.";
    }
    return { reply, provider: 'fallback' };
  }

  const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages,
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return {
    reply: data.choices?.[0]?.message?.content || 'I could not generate a response right now.',
    provider: config.aiProvider,
  };
}

async function mediate({ conversation, language, coupleContext = {} }) {
  const msgs = [
    { role: 'system', content: systemPrompt('mediation', { language }) },
    {
      role: 'user',
      content: `Mediate this disagreement. Conversation:\n${conversation}\n\nContext: ${JSON.stringify(coupleContext)}`,
    },
  ];
  return callAi(msgs);
}

async function coach({ message, language, coupleContext = {} }) {
  const msgs = [
    { role: 'system', content: systemPrompt('coaching', { language }) },
    {
      role: 'user',
      content: `Coach this message for kinder, clearer communication:\n"${message}"\n\nContext: ${JSON.stringify(coupleContext)}`,
    },
  ];
  return callAi(msgs);
}

async function insight({ coupleId, messages = [], goals = [], language }) {
  const msgs = [
    { role: 'system', content: systemPrompt('insight', { language }) },
    {
      role: 'user',
      content: `Generate a relationship insight. Recent messages:\n${JSON.stringify(messages)}\nGoals:\n${JSON.stringify(goals)}\nCouple ID: ${coupleId}`,
    },
  ];
  return callAi(msgs);
}

async function translate({ text, targetLanguage }) {
  const msgs = [
    { role: 'system', content: systemPrompt('translation', { language: targetLanguage }) },
    { role: 'user', content: text },
  ];
  return callAi(msgs);
}

async function analyzePattern({ conversation, language, coupleContext = {} }) {
  const msgs = [
    { role: 'system', content: systemPrompt('pattern', { language }) },
    {
      role: 'user',
      content: `Analyze this conversation for patterns:\n${conversation}\n\nContext: ${JSON.stringify(coupleContext)}`,
    },
  ];
  return callAi(msgs);
}

async function identifyMisunderstanding({ conversation, language, coupleContext = {} }) {
  const msgs = [
    { role: 'system', content: systemPrompt('misunderstanding', { language }) },
    {
      role: 'user',
      content: `Review this conversation for potential misunderstandings:\n${conversation}\n\nContext: ${JSON.stringify(coupleContext)}`,
    },
  ];
  return callAi(msgs);
}

async function suggestReply({ conversation, language, coupleContext = {} }) {
  const msgs = [
    { role: 'system', content: systemPrompt('reply_suggestion', { language }) },
    {
      role: 'user',
      content: `Suggest constructive replies for this conversation:\n${conversation}\n\nContext: ${JSON.stringify(coupleContext)}`,
    },
  ];
  return callAi(msgs);
}

async function summarizeConversation({ conversation, language, coupleContext = {} }) {
  const msgs = [
    { role: 'system', content: systemPrompt('summary', { language }) },
    {
      role: 'user',
      content: `Generate a conversation summary:\n${conversation}\n\nContext: ${JSON.stringify(coupleContext)}`,
    },
  ];
  return callAi(msgs);
}

module.exports = {
  mediate,
  coach,
  insight,
  translate,
  analyzePattern,
  identifyMisunderstanding,
  suggestReply,
  summarizeConversation,
};
