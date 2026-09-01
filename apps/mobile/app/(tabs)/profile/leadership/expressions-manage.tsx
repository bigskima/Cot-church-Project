import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

interface ExpressionItem {
  id: string;
  name: string;
  code: string;
  timezone?: string;
  is_active?: boolean;
}

export default function ExpressionsManageScreen() {
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const expressions = useResource<ExpressionItem[]>('leadership:expressions', (signal) =>
    api.request<ExpressionItem[]>('branches', { signal }).catch(() => [])
  );

  const handleBootstrapExpression = async () => {
    if (!name.trim() || !code.trim()) {
      setErrorMsg('Please provide both expression name and unique campus code.');
      return;
    }
    setBootstrapping(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.request('branches', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          timezone,
        }),
      });
      setName('');
      setCode('');
      setSuccessMsg(`Campus expression "${name.trim()}" created successfully.`);
      expressions.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create expression campus.');
    } finally {
      setBootstrapping(false);
    }
  };

  const list = expressions.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
      >
        <ScreenHeader
          title="Campus Expressions & Directory"
          subtitle="Provision new sanctuary campuses and daughter church locations."
          showBack
        />

        <View style={styles.body}>
          {/* Notification Messages */}
          {successMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(22, 163, 106, 0.12)', borderColor: 'rgba(22, 163, 106, 0.3)' }]}>
              <Icon name="checkmark-circle" size={18} color="#16A36A" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#16A36A' }]}>{successMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(229, 72, 77, 0.12)', borderColor: 'rgba(229, 72, 77, 0.3)' }]}>
              <Icon name="alert-circle" size={18} color="#E5484D" style={{ marginRight: 8 }} />
              <Text style={[styles.bannerText, { color: '#E5484D' }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Create Expression Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Icon name="business-outline" size={18} color={colors.interactive} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Add Church Expression Campus</Text>
            </View>

            <InputField
              label="Expression / Campus Name"
              value={name}
              onChangeText={(val) => {
                setName(val);
                if (!code) setCode(val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase());
              }}
              placeholder="e.g. London City Sanctuary"
            />

            <InputField
              label="Campus Short Code"
              value={code}
              onChangeText={(val) => setCode(val.toUpperCase())}
              placeholder="e.g. LON-01"
            />

            <InputField
              label="Timezone"
              value={timezone}
              onChangeText={setTimezone}
              placeholder="e.g. Europe/London"
            />

            <Button
              label="Provision Campus Expression"
              onPress={handleBootstrapExpression}
              loading={bootstrapping}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Active Expressions List */}
          <View style={styles.listSection}>
            <SectionHeader title="Active Church Campuses" badge={list.length} />
            {expressions.loading ? (
              <Skeleton height={80} count={2} />
            ) : expressions.error && !expressions.data ? (
              <ResourceError message={expressions.error} retry={expressions.refresh} />
            ) : list.length > 0 ? (
              list.map((exp) => (
                <View
                  key={exp.id}
                  style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                >
                  <View style={styles.tileInfo}>
                    <Text style={[styles.tileTitle, { color: colors.text }]}>{exp.name}</Text>
                    <Text style={[styles.tileMeta, { color: colors.interactive }]}>
                      Code: {exp.code} {exp.timezone ? `· ${exp.timezone}` : ''}
                    </Text>
                  </View>
                  <Badge label="ACTIVE" variant="primary" />
                </View>
              ))
            ) : (
              <EmptyState
                title="No Expressions Registered"
                message="Provision your first church campus using the form above."
                iconName="business-outline"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  listSection: {
    gap: spacing.xs,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  tileInfo: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  tileMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
});
