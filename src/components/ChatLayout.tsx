import React, { useState, useEffect } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { PointsDisplay } from "@/components/PointsDisplay";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export const ChatLayout = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
      if (data && data.length > 0) {
        setActiveConversationId(data[0].id);
      } else {
        await createNewConversation();
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const createNewConversation = async (title = "New Conversation") => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select()
        .single();

      if (error) throw error;
      setConversations((prev) => [data, ...prev]);
      setActiveConversationId(data.id);
      return data;
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const updateConversationTitle = async (id: string, title: string) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ title })
        .eq("id", id);

      if (error) throw error;
      setConversations((prev) =>
        prev.map((conv) => (conv.id === id ? { ...conv, title } : conv))
      );
    } catch (error) {
      console.error("Error updating conversation title:", error);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      const { error } = await supabase.from("conversations").delete().eq("id", id);
      if (error) throw error;

      setConversations((prev) => prev.filter((conv) => conv.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((conv) => conv.id !== id);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          await createNewConversation();
        }
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-full p-8">
          <div className="spinner w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b border-glass-border glass-elevated p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition md:hidden"
          >
            ☰
          </button>
          <h1 className="text-xl font-semibold gradient-text">ChronoChat Prime</h1>
        </div>
        <PointsDisplay />
      </div>

      {/* Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-background border-r border-glass-border transform z-50 transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => {
            setActiveConversationId(id);
            setSidebarOpen(false);
          }}
          onNewConversation={createNewConversation}
          onDeleteConversation={deleteConversation}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col md:ml-72">
        {activeConversationId && (
          <ChatInterface
            conversationId={activeConversationId}
            onUpdateTitle={(title) =>
              updateConversationTitle(activeConversationId, title)
            }
          />
        )}
      </div>
    </div>
  );
};
