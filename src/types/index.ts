// Core data types for Golf Partner

export type PlayingStyle = 'competitive' | 'casual';

export interface UserProfile {
  id: string;
  name: string;
  photoUrl?: string;
  handicap: number;
  age: number;
  clubMemberships: string[]; // Club IDs
  playingStyle: PlayingStyle;
  upForDrinkAfterwards: boolean;
  occupation?: string; // Optional networking field
  location: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GolfClub {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  website?: string;
}

export interface Round {
  id: string;
  hostId: string; // User who created the round
  clubId: string;
  scheduledFor: string; // ISO datetime
  playersNeeded: number; // How many extra players wanted
  playersJoined: string[]; // User IDs who have joined
  playersPending: string[]; // User IDs who have requested to join
  notes?: string;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface JoinRequest {
  id: string;
  roundId: string;
  requesterId: string;
  hostId: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface Chat {
  id: string;
  participantIds: [string, string];
  lastMessage?: ChatMessage;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'join_request' | 'match' | 'chat' | 'round_reminder';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}
