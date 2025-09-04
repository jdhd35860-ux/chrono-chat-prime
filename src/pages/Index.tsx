import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatLayout } from '@/components/ChatLayout';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-full p-8">
          <div className="spinner w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return <ChatLayout />;
};

export default Index;
