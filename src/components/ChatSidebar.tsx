import React from 'react';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Plus, MessageSquare, Trash2, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar className="w-80 glass-elevated border-r border-glass-border">
      <SidebarHeader className="p-4 border-b border-glass-border">
        <Button
          onClick={onNewConversation}
          className="w-full justify-start gap-2 hover-glow"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {conversations.map((conversation) => (
            <SidebarMenuItem key={conversation.id}>
              <div className="flex items-center group">
                <SidebarMenuButton
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`flex-1 justify-start gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                    activeConversationId === conversation.id
                      ? 'bg-primary/10 border border-primary/20 glow-cyan'
                      : ''
                  }`}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate text-sm">
                    {conversation.title}
                  </span>
                </SidebarMenuButton>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteConversation(conversation.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <div className="p-4 border-t border-glass-border">
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 glass hover-glow"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </Sidebar>
  );
};