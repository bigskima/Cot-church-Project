import React, { type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { ExpressionManagementHeader, type ExpressionManagementSection } from '@/components/expression/ExpressionManagementHeader';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Props = PropsWithChildren<{
  expressionId: string;
  active: ExpressionManagementSection;
  title: string;
  subtitle: string;
  icon: string;
}>;

export function ExpressionManagementWorkspace({
  expressionId,
  active,
  title,
  subtitle,
  icon,
  children,
}: Props) {
  const { context } = useSession();
  const { colors } = useTheme();
  const expressionName =
    context?.expression?.id === expressionId
      ? context.expression.name
      : context?.expressions?.find((item) => item.id === expressionId)?.name ?? 'This Expression';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ExpressionManagementHeader
        expressionId={expressionId}
        expressionName={expressionName}
        active={active}
        title={title}
        subtitle={subtitle}
        icon={icon}
      />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, minHeight: 0 },
});
