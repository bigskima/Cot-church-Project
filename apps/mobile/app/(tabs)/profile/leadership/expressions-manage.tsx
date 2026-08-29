import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  EmptyState,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';

interface ExpressionItem {
  id: string;
  name: string;
  code: string;
  timezone?: string;
  is_active?: boolean;
}

export default function ExpressionsManageScreen() {
  const { api } = useSession();
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const expressions = useResource<ExpressionItem[]>('leadership:expressions', (signal) =>
    api.request<ExpressionItem[]>('branches', { signal })
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
      setSuccessMsg(`Campus expression "${name.trim()}" bootstrapped successfully with initial leadership authority!`);
      expressions.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to bootstrap expression campus.');
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Expressions & Campus Bootstrap"
        subtitle="Provision local church campuses, daughter churches, and establish responsible authority."
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {/* Bootstrap New Campus Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            shadows.md,
          ] as any}
        >
          <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }] as any}>
            BOOTSTRAP NEW CHURCH EXPRESSION
          </Text>
          <Text style={[styles.cardHelper, { color: colors.textMuted }] as any}>
            Every church expression is established with designated leadership authority to assign local pastors, media operators, and department coordinators.
          </Text>

          <InputField
            label="Expression / Campus Name"
            value={name}
            onChangeText={(val) => {
              setName(val);
              if (!code) {
                setCode(val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase());
              }
            }}
            placeholder="e.g. North Sanctuary Campus, Downtown Expression"
            dark={isDark}
          />

          <InputField
            label="Unique Campus Code"
            value={code}
            onChangeText={(val) => setCode(val.toUpperCase())}
            placeholder="e.g. NORTH-01"
            helperText="Used for check-in scanners, department namespaces, and routing."
            dark={isDark}
          />

          <InputField
            label="Campus Timezone"
            value={timezone}
            onChangeText={setTimezone}
            placeholder="e.g. America/New_York, Europe/London"
            dark={isDark}
          />

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

          <Button
            label="Bootstrap Church Expression ➔"
            onPress={handleBootstrapExpression}
            variant="gold"
            size="lg"
            loading={bootstrapping}
            style={{ marginTop: spacing.md } as any}
          />
        </View>

        {/* Existing Expressions List */}
        <SectionHeader
          title="Active Church Expressions"
          badge={expressions.data?.length ?? 0}
          dark={isDark}
        />
        {expressions.loading ? (
          <Skeleton height={90} count={2} dark={isDark} />
        ) : expressions.error && !expressions.data ? (
          <ResourceError
            offline={expressions.offline}
            message={expressions.error}
            retry={expressions.refresh}
            dark={isDark}
          />
        ) : expressions.data && expressions.data.length > 0 ? (
          expressions.data.map((exp) => (
            <View
              key={exp.id}
              style={[
                styles.expCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.sm,
              ] as any}
            >
              <View
                style={[
                  styles.expIconCircle,
                  { backgroundColor: isDark ? '#2E1C11' : '#F1E3D3' },
                ] as any}
              >
                <Text style={styles.expIcon as any}>🏛️</Text>
              </View>
              <View style={styles.expInfo}>
                <Text style={[styles.expTitle, { color: colors.text }] as any}>{exp.name}</Text>
                <Text style={[styles.expMeta, { color: colors.textMuted }] as any}>
                  Code: <Text style={{ fontWeight: '900', color: colors.text } as any}>{exp.code}</Text> · {exp.timezone || 'UTC'}
                </Text>
              </View>
              <Badge label={exp.is_active !== false ? 'ACTIVE' : 'INACTIVE'} variant="success" />
            </View>
          ))
        ) : (
          <EmptyState
            title="No Additional Expressions"
            message="Main sanctuary is currently active. Bootstrap new campuses above."
            icon="🏛️"
            dark={isDark}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cardHelper: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  errorText: {
    color: palette.live,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  successText: {
    color: palette.success,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  expCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  expIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expIcon: {
    fontSize: 20,
  },
  expInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  expTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  expMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});
