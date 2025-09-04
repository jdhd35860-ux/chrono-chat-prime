import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  conversationId: string;
  style?: string;
  boost?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the user from the JWT token
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { message, conversationId, style = 'default', boost = false }: ChatRequest = await req.json();

    if (!message || !conversationId) {
      throw new Error('Message and conversation ID are required');
    }

    const startTime = Date.now();

    // Get conversation history
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('content, role')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw new Error('Failed to fetch conversation history');
    }

    // Save user message
    const { error: saveUserMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        content: message,
        role: 'user'
      });

    if (saveUserMessageError) {
      console.error('Error saving user message:', saveUserMessageError);
    }

    // Build conversation context
    const conversationHistory: ChatMessage[] = messages || [];
    conversationHistory.push({ role: 'user', content: message });

    // Create system prompt based on style
    let systemPrompt = "You are a helpful AI assistant powered by Gemini 2.5 Flash. Provide accurate, helpful, and engaging responses.";
    
    switch (style) {
      case 'creative':
        systemPrompt = "You are a creative and imaginative AI assistant. Respond with flair, creativity, and engaging storytelling elements.";
        break;
      case 'professional':
        systemPrompt = "You are a professional AI assistant. Provide formal, structured, and business-appropriate responses.";
        break;
      case 'casual':
        systemPrompt = "You are a casual and friendly AI assistant. Use a relaxed, conversational tone with occasional humor.";
        break;
      case 'technical':
        systemPrompt = "You are a technical expert AI assistant. Provide detailed, precise, and technically accurate responses.";
        break;
    }

    if (boost) {
      systemPrompt += " This is a boosted request - provide an especially detailed and comprehensive response.";
    }

    // Prepare messages for Gemini
    const geminiMessages = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    ];

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: boost ? 4096 : 2048,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error('Failed to get response from Gemini');
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      throw new Error('No response generated from Gemini');
    }

    const aiResponse = geminiData.candidates[0].content.parts[0].text;
    const responseTime = Date.now() - startTime;
    const tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0;

    // Calculate points awarded
    let pointsAwarded = 1; // Base point for valid message
    
    // Check for daily streak bonus
    const today = new Date().toISOString().split('T')[0];
    const { data: userPoints } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (userPoints) {
      const lastActivityDate = userPoints.last_activity_date;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = 1;
      if (lastActivityDate === yesterdayStr) {
        newStreak = userPoints.current_streak + 1;
        pointsAwarded += 5; // Daily streak bonus
      } else if (lastActivityDate === today) {
        newStreak = userPoints.current_streak;
        pointsAwarded = 1; // No bonus for same day
      }

      // Subtract points for boost usage
      let pointsCost = 0;
      if (boost) {
        pointsCost = 10;
      }

      // Update user points
      const newTotalPoints = Math.max(0, userPoints.total_points + pointsAwarded - pointsCost);
      const newPointsSpent = userPoints.points_spent + pointsCost;

      await supabase
        .from('user_points')
        .update({
          total_points: newTotalPoints,
          points_spent: newPointsSpent,
          current_streak: newStreak,
          last_activity_date: today
        })
        .eq('user_id', user.id);
    }

    // Save assistant message
    const { error: saveAssistantMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        content: aiResponse,
        role: 'assistant',
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        points_awarded: pointsAwarded
      });

    if (saveAssistantMessageError) {
      console.error('Error saving assistant message:', saveAssistantMessageError);
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        tokensUsed,
        responseTime,
        pointsAwarded
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in chat-with-gemini function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred while processing your request'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});