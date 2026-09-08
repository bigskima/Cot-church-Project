import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, usePathname } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

function generalTarget(pathname: string) {
  if (pathname === '/' || pathname === '/home') return '/general';
  if (pathname === '/discover') return '/general/explore';
  if (pathname === '/discover/church-story') return '/general/church-story';
  if (pathname.startsWith('/discover/sermon/')) return pathname.replace('/discover/sermon/', '/general/sermon/');
  if (pathname === '/reels') return '/general/reels';
  if (pathname === '/community') return '/general/community';
  if (pathname === '/live') return '/general/live';
  if (pathname.startsWith('/live/')) return `/general${pathname}`;
  if (pathname === '/watch') return '/general/watch';
  if (pathname.startsWith('/watch/')) return `/general${pathname}`;
  if (pathname === '/profile') return '/general/profile';
  if (pathname === '/profile/settings') return '/general/settings';
  if (pathname === '/profile/notifications') return '/general/notifications';
  if (pathname === '/profile/notification-settings') return '/general/notification-settings';
  if (pathname === '/profile/saved') return '/general/saved';
  if (pathname === '/profile/prayer') return '/general/prayer';
  if (pathname === '/profile/giving') return '/general/giving';
  if (pathname === '/profile/leadership') return '/general/leadership';

  const leadership = pathname.match(/^\/profile\/leadership\/(.+)$/)?.[1];
  if (leadership) {
    const map: Record<string, string> = {
      'media-studio': 'media-studio',
      'pastoral-triage': 'pastoral-triage',
      'church-leadership': 'church-leadership',
      'giving-manage': 'giving-manage',
      'giving-finance': 'giving-finance',
      'sermons-manage': 'sermons-manage',
      'events-manage': 'events-manage',
      'expressions-manage': 'expressions-manage',
    };
    const destination = map[leadership];
    if (destination) return `/general/leadership/${destination}`;
    return '/general/leadership';
  }

  return '/general';
}

function expressionCompatibilityTarget(pathname: string, expressionId: string) {
  if (pathname === '/community/groups') return `/expressions/${expressionId}/groups`;
  if (pathname === '/community/birthdays') return `/expressions/${expressionId}/birthdays`;
  if (pathname === '/community/leadership') return `/expressions/${expressionId}/leadership`;

  if (pathname.startsWith('/profile/leadership/')) {
    const tool = pathname.split('/').pop() ?? '';
    const map: Record<string, string> = {
      'media-studio': 'live',
      'sermons-manage': 'sermons',
      'events-manage': 'events',
      'expression-leadership': 'leadership',
      'expression-governance': 'access',
      'giving-manage': 'giving',
      'giving-finance': 'finance',
    };
    const destination = map[tool];
    if (destination) return `/expressions/${expressionId}/manage/${destination}`;
    return `/expressions/${expressionId}/manage`;
  }

  return null;
}

/**
 * Phase 7 compatibility boundary.
 *
 * The old tab tree no longer owns product navigation. Existing browser history,
 * bookmarks and older app links are forwarded into the canonical General COT or
 * exact Expression workspace so there is only one navigation model to maintain.
 */
export default function LegacyTabRedirect() {
  const pathname = usePathname();
  const { colors } = useTheme();
  const { mode, accessReady, context } = useSession();

  if (mode === 'restoring' || (mode === 'authenticated' && !accessReady)) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.interactive} />
      </View>
    );
  }

  const expressionId = context?.expression?.id;
  if (expressionId) {
    const exactExpressionTarget = expressionCompatibilityTarget(pathname, expressionId);
    if (exactExpressionTarget) return <Redirect href={exactExpressionTarget as any} />;
  }

  if (pathname === '/community/groups' || pathname === '/community/birthdays' || pathname === '/community/leadership') {
    return <Redirect href="/expressions" />;
  }

  return <Redirect href={generalTarget(pathname) as any} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
