import React, { useState } from 'react';
import { entities, auth, integrations } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function SeedFriends() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const seedData = async () => {
    setLoading(true);
    try {
      const currentUser = await auth.me();
      
      // Create UserProfiles for fake users first
      const fakeUsers = [
        { id: "fake_user_1", name: "Killa", discriminator: "0001" },
        { id: "fake_user_2", name: "Venom", discriminator: "0002" },
        { id: "fake_user_3", name: "Ghost", discriminator: "0003" },
        { id: "fake_user_4", name: "Viper", discriminator: "0004" },
        { id: "fake_user_5", name: "Jinx", discriminator: "0005" }
      ];

      // Create profiles for these fake users
      for (const user of fakeUsers) {
        try {
          await entities.UserProfile.create({
            user_id: user.id,
            display_name: user.name,
            discriminator: user.discriminator,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
            status: 'online'
          });
        } catch (e) {
          console.log('Profile might already exist for', user.name);
        }
      }

      // Create friend relationships
      for (const user of fakeUsers) {
        try {
          await entities.Friend.create({
            user_id: currentUser.id,
            friend_id: user.id,
            friend_name: user.name,
            friend_discriminator: user.discriminator,
            friend_avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
            status: 'accepted'
          });
        } catch (e) {
          console.log('Friend might already exist:', user.name);
        }
      }

      // Create some DMs with unread messages
      const conversations = [
        {
          friendId: "fake_user_1",
          friendName: "Killa",
          messages: [
            { content: "Hey! Want to team up for a raid tonight?", unread: true },
            { content: "I got some new legendary gear", unread: true }
          ]
        },
        {
          friendId: "fake_user_2",
          friendName: "Venom",
          messages: [
            { content: "Check out this sick play I just made!", unread: true },
            { content: "Uploading the clip now", unread: true },
            { content: "You gotta see this", unread: true },
            { content: "🔥🔥🔥", unread: true },
            { content: "When are you getting online?", unread: true }
          ]
        },
        {
          friendId: "fake_user_3",
          friendName: "Ghost",
          messages: [
            { content: "Dude where did you go?", unread: false }
          ]
        },
        {
          friendId: "fake_user_4",
          friendName: "Viper",
          messages: [
            { content: "GG last match", unread: false }
          ]
        }
      ];

      let messagesCreated = 0;
      for (const conv of conversations) {
        const conversationId = [currentUser.id, conv.friendId].sort().join('-');
        
        for (const msg of conv.messages) {
          try {
            await entities.DirectMessage.create({
              conversation_id: conversationId,
              sender_id: conv.friendId,
              sender_name: conv.friendName,
              sender_avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.friendName}`,
              recipient_id: currentUser.id,
              content: msg.content,
              is_read: !msg.unread
            });
            messagesCreated++;
          } catch (err) {
            console.error('Failed to create DM:', err);
          }
        }
      }

      // Invalidate ALL queries to force refresh
      queryClient.invalidateQueries();
      
      toast.success(`✅ Created ${fakeUsers.length} friends and ${messagesCreated} messages! Refreshing...`);
      
      // Reload the page to clear all caches
      setTimeout(() => {
        window.location.href = createPageUrl('Home');
      }, 1000);
    } catch (error) {
      toast.error('Failed to seed data: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-8">
      <div className="bg-zinc-800 rounded-2xl p-8 border border-red-900/20 max-w-md w-full">
        <Link to={createPageUrl('Home')} className="inline-flex items-center text-red-500 hover:text-red-400 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <h1 className="text-2xl font-bold text-white mb-4">Seed Test Data</h1>
        <p className="text-zinc-400 mb-6">
          This will create 5 fake friends with recent messages so you can see the QuickHeads feature in action.
        </p>
        <Button 
          onClick={seedData} 
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-lg py-6"
        >
          {loading ? 'Creating Test Data...' : '🚀 Create Test Friends & Messages'}
        </Button>
        <p className="text-zinc-500 text-sm mt-4">
          After creating, go to the <Link to={createPageUrl('Home')} className="text-red-500 hover:underline">Friends tab</Link> to see the story-style DM carousel at the top!
        </p>
      </div>
    </div>
  );
}