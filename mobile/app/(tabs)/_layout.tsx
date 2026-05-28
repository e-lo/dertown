import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { THEME } from '../../lib/theme';
import { Icon } from '../../components/Icon';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: THEME.tabBarBackground,
          borderTopColor: 'rgba(255,255,255,0.08)',
          // Android centers content with explicit height + padding
          ...(Platform.OS === 'android' ? { height: 60, paddingBottom: 8, paddingTop: 4 } : {}),
        },
        tabBarActiveTintColor:   THEME.tabBarActive,
        tabBarInactiveTintColor: THEME.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Icon name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="starred"
        options={{
          title: 'Starred',
          tabBarIcon: ({ color, size }) => <Icon name="star" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color, size }) => <Icon name="bell" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
