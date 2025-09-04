import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Copy, RotateCcw, Clock, Zap, User, Bot } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  tokens_used?: number;
  response_time_ms?: number;
  points_awarded?: number;
  created_at: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  onUpdateTitle: (title: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversationId,
  onUpdateTitle,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [boost, setBoost] = useState(false);
  const [style, setStyle] = useState('default');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading || !user) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    // Add user message immediately to UI
    const tempMessage: Message = {
      id: 'temp',
      content: userMessage,
      role: 'user',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      // Call the Gemini Edge Function
      const { data, error } = await supabase.functions.invoke('chat-with-gemini', {
        body: {
          message: userMessage,
          conversationId,
          style,
          boost,
        },
      });

      if (error) throw error;

      // Reload messages to get the latest from the database
      await loadMessages();

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = userMessage.length > 50 
          ? userMessage.substring(0, 47) + '...' 
          : userMessage;
        onUpdateTitle(title);
      }

      // Reset boost after use
      setBoost(false);

      if (data.pointsAwarded > 1) {
        toast({
          title: 'Streak Bonus!',
          description: `You earned ${data.pointsAwarded} points (including daily streak bonus)!`,
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      
      // Remove the temporary message on error
      setMessages(prev => prev.filter(msg => msg.id !== 'temp'));
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied!',
      description: 'Message copied to clipboard.',
    });
  };

  const regenerateResponse = async (messageIndex: number) => {
    if (messageIndex === 0 || loading) return;

    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-gemini', {
        body: {
          message: userMessage.content,
          conversationId,
          style,
          boost,
        },
      });

      if (error) throw error;
      await loadMessages();
      setBoost(false);
    } catch (error) {
      console.error('Error regenerating response:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate response.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 mx-auto text-neon-cyan glow-cyan mb-4" />
            <h3 className="text-lg font-semibold gradient-text">Welcome to ChronoChat Prime</h3>
            <p className="text-muted-foreground">Start a conversation with Gemini 2.5 Flash</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center">
                  <Bot className="h-4 w-4 text-neon-cyan" />
                </div>
              </div>
            )}

            <div className={`max-w-[80%] ${message.role === 'user' ? 'message-user' : 'message-assistant'}`}>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>

              {/* Message metadata */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-glass-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {message.response_time_ms && (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {message.response_time_ms}ms
                    </Badge>
                  )}
                  {message.tokens_used && (
                    <Badge variant="outline" className="text-xs">
                      {message.tokens_used} tokens
                    </Badge>
                  )}
                  {message.points_awarded && message.points_awarded > 0 && (
                    <Badge variant="outline" className="text-xs text-neon-cyan">
                      +{message.points_awarded} pts
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyMessage(message.content)}
                    className="h-6 w-6 p-0 hover:bg-muted/50"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {message.role === 'assistant' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateResponse(index)}
                      disabled={loading}
                      className="h-6 w-6 p-0 hover:bg-muted/50"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center">
                  <User className="h-4 w-4 text-neon-purple" />
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full glass flex items-center justify-center">
                <Bot className="h-4 w-4 text-neon-cyan" />
              </div>
            </div>
            <div className="ml-3 message-assistant">
              <div className="flex items-center gap-2">
                <div className="spinner w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full"></div>
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-glass-border glass-elevated p-4">
        <form onSubmit={sendMessage} className="space-y-3">
          {/* Style and Boost Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="glass rounded px-2 py-1 text-xs border border-glass-border bg-transparent"
            >
              <option value="default">Default</option>
              <option value="creative">Creative</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="technical">Technical</option>
            </select>

            <Button
              type="button"
              variant={boost ? "default" : "outline"}
              size="sm"
              onClick={() => setBoost(!boost)}
              className={`text-xs ${boost ? 'glow-cyan' : ''}`}
            >
              <Zap className="h-3 w-3 mr-1" />
              Boost (-10 pts)
            </Button>
          </div>

          {/* Message Input */}
          <div className="flex gap-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="glass min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
            />
            <Button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="px-4 hover-glow"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </div>
        </form>
      </div>
    </div>
  );
};