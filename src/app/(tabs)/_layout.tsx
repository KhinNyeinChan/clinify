import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { type ColorValue, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { useI18n } from '@/constants/i18n';

const ACTIVE_TAB_COLOR = Palette.primary;
const INACTIVE_TAB_COLOR = '#9CA3AF';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  focused,
  color,
  size,
  outline,
  solid,
}: {
  focused: boolean;
  color: ColorValue;
  size: number;
  outline: IoniconName;
  solid: IoniconName;
}) {
  return <Ionicons name={focused ? solid : outline} size={size} color={color} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 10);
  const tabs = useI18n().tabs;

  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_TAB_COLOR,
        tabBarInactiveTintColor: INACTIVE_TAB_COLOR,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarStyle: [styles.tabBar, { bottom: bottomOffset }],
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: tabs.home,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              outline="home-outline"
              solid="home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="clinic"
        options={{
          title: tabs.clinic,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              outline="medical-outline"
              solid="medkit"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: tabs.visits,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              outline="calendar-outline"
              solid="calendar"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: tabs.inventory,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              outline="cube-outline"
              solid="cube"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: tabs.report,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              outline="bar-chart-outline"
              solid="bar-chart"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    position: 'absolute',
    left: 16,
    right: 16,
    height: 68,
    borderRadius: 24,
    paddingTop: 8,
    paddingBottom: 8,
    overflow: 'visible',
    boxShadow: '0px -4px 12px rgba(31, 41, 55, 0.08)',
    elevation: 12,
  },
  item: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
