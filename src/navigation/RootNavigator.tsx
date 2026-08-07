import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useNotifications } from '../hooks/useNotifications';
import {
  HomeTabIcon,
  MapTabIcon,
  CalendarTabIcon,
  ChatTabIcon,
  ProfileTabIcon,
} from '../components/TabIcons';
import AppIcon from '../components/AppIcon';

import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Tab = createBottomTabNavigator();

// Header bell icon with unread badge.
function NotificationBell({ onPress }: { onPress: () => void }) {
  const { unreadCount } = useNotifications();
  return (
    <TouchableOpacity onPress={onPress} style={styles.bellWrap} hitSlop={10}>
      <AppIcon name="bell" size={26} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function RootNavigator() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Overlay NotificationsScreen on top of the tabs when open.
  if (notificationsOpen) {
    return (
      <NavigationContainer>
        <NotificationsScreen
          onBack={() => setNotificationsOpen(false)}
          // Deep-link handlers can be wired up later. For now, tapping a
          // notification marks it read and closes back to the tabs; the user
          // can navigate to the round/chat/friend request via the normal tabs.
          onOpenRound={() => setNotificationsOpen(false)}
          onOpenConversation={() => setNotificationsOpen(false)}
          onOpenFriendRequests={() => setNotificationsOpen(false)}
          onOpenPlayer={() => setNotificationsOpen(false)}
        />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.accent, // sage green when focused
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontFamily: fonts.semibold,
            fontSize: 11,
            letterSpacing: 0.2,
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 84,
            paddingTop: 8,
            paddingBottom: 24,
          },
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.white,
          headerTitleStyle: {
            fontFamily: fonts.bold,
            fontSize: 18,
            letterSpacing: -0.2,
          },
          headerRight: () => (
            <NotificationBell onPress={() => setNotificationsOpen(true)} />
          ),
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Find Players',
            tabBarIcon: ({ color, focused }) => <HomeTabIcon color={color} focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{
            title: 'Courses',
            tabBarIcon: ({ color, focused }) => <MapTabIcon color={color} focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            title: 'Plan a Round',
            tabBarIcon: ({ color, focused }) => <CalendarTabIcon color={color} focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatListScreen}
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => <ChatTabIcon color={color} focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'My Profile',
            tabBarIcon: ({ color, focused }) => <ProfileTabIcon color={color} focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bellWrap: {
    marginRight: 14,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
