import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Zap, Star, Flame, Trophy, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserPoints {
  total_points: number;
  points_spent: number;
  current_streak: number;
  last_activity_date: string;
}

export const PointsDisplay = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserPoints();
    }
  }, [user]);

  const loadUserPoints = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setUserPoints(data);
    } catch (error) {
      console.error('Error loading user points:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchaseItem = async (itemType: string, itemName: string, cost: number) => {
    if (!user || !userPoints) return;

    if (userPoints.total_points < cost) {
      toast({
        title: 'Insufficient Points',
        description: `You need ${cost} points but only have ${userPoints.total_points}.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Record the purchase
      const { error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          item_type: itemType,
          item_name: itemName,
          points_cost: cost,
        });

      if (purchaseError) throw purchaseError;

      // Update user points
      const newTotalPoints = userPoints.total_points - cost;
      const newPointsSpent = userPoints.points_spent + cost;

      const { error: updateError } = await supabase
        .from('user_points')
        .update({
          total_points: newTotalPoints,
          points_spent: newPointsSpent,
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setUserPoints({
        ...userPoints,
        total_points: newTotalPoints,
        points_spent: newPointsSpent,
      });

      toast({
        title: 'Purchase Successful!',
        description: `You've purchased ${itemName} for ${cost} points.`,
      });
    } catch (error) {
      console.error('Error purchasing item:', error);
      toast({
        title: 'Purchase Failed',
        description: 'There was an error processing your purchase.',
        variant: 'destructive',
      });
    }
  };

  if (loading || !userPoints) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-6 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Points Display */}
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-neon-cyan" />
        <span className="font-medium">{userPoints.total_points}</span>
      </div>

      {/* Streak Display */}
      {userPoints.current_streak > 0 && (
        <div className="flex items-center gap-1">
          <Flame className="h-4 w-4 text-orange-500" />
          <Badge variant="outline" className="text-xs">
            {userPoints.current_streak} day streak
          </Badge>
        </div>
      )}

      {/* Shop */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="glass hover-glow">
            <ShoppingCart className="h-4 w-4 mr-1" />
            Shop
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 glass-elevated">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold gradient-text">Point Shop</h3>
              <p className="text-sm text-muted-foreground">
                Spend your points on special features
              </p>
            </div>

            <div className="space-y-3">
              {/* Boost */}
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-neon-cyan" />
                      <div>
                        <h4 className="font-medium">Boost</h4>
                        <p className="text-xs text-muted-foreground">
                          Priority response with extra detail
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => purchaseItem('boost', 'Response Boost', 10)}
                      disabled={userPoints.total_points < 10}
                      className="hover-glow"
                    >
                      10 pts
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Style Packs */}
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-neon-purple" />
                      <h4 className="font-medium">Style Packs</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'Creative', description: 'Imaginative responses' },
                        { name: 'Professional', description: 'Formal tone' },
                        { name: 'Casual', description: 'Relaxed style' },
                        { name: 'Technical', description: 'Expert details' },
                      ].map((style) => (
                        <Button
                          key={style.name}
                          size="sm"
                          variant="outline"
                          onClick={() => purchaseItem('style_pack', style.name, 5)}
                          disabled={userPoints.total_points < 5}
                          className="h-auto flex-col gap-1 p-2 text-xs glass hover-glow"
                        >
                          <span className="font-medium">{style.name}</span>
                          <span className="text-xs text-muted-foreground">5 pts</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};