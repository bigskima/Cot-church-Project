import React, { useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, SearchBar, Table, Toggle } from '../components/ui';

interface FeatureFlag {
  key: string;
  name: string;
  category: 'core' | 'media' | 'intelligence' | 'finance' | 'social';
  description: string;
  global_enabled: boolean;
  rollout_percentage: number;
}

const defaultFlags: FeatureFlag[] = [
  {
    key: 'livestream_realtime_chat',
    name: 'Livestream Real-Time Chat & Emojis',
    category: 'media',
    description: 'Enable interactive member chat and floating reactions during live broadcasts.',
    global_enabled: true,
    rollout_percentage: 100,
  },
  {
    key: 'ai_sermon_intelligence',
    name: 'AI Sermon Intelligence & Study Notes',
    category: 'intelligence',
    description: 'Automatic transcription, scripture extraction, and lesson summaries.',
    global_enabled: true,
    rollout_percentage: 100,
  },
  {
    key: 'giving_reconciliation_engine',
    name: 'Multi-Currency Giving & Instant Receipts',
    category: 'finance',
    description: 'Automated settlement fee tracking and multi-gateway matching.',
    global_enabled: true,
    rollout_percentage: 100,
  },
  {
    key: 'social_community_feed',
    name: 'Sanctuary Community Social Feed',
    category: 'social',
    description: 'Scoped posts, testimonies, and prayer agreement reactions for church members.',
    global_enabled: true,
    rollout_percentage: 100,
  },
  {
    key: 'pastoral_triage_altar_calls',
    name: 'Pastoral Triage & Altar Responses',
    category: 'core',
    description: 'Confidential prayer queue, altar calls, and ministerial assignments.',
    global_enabled: true,
    rollout_percentage: 100,
  },
];

export function FeatureFlags({ api }: { api: ApiClient }) {
  const [flags, setFlags] = useState<FeatureFlag[]>(defaultFlags);
  const [search, setSearch] = useState('');

  const toggleFlag = (key: string) => {
    setFlags((list) =>
      list.map((f) => (f.key === key ? { ...f, global_enabled: !f.global_enabled } : f))
    );
  };

  const filtered = flags.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Card
        title="Platform Feature Capabilities & Rollouts"
        subtitle="Dynamically control platform modules globally or per organisation without redeploying code"
        headerAction={
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search capability flags..."
          />
        }
      >
        <Table
          columns={[
            {
              header: 'FEATURE / CAPABILITY',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <code style={{ color: 'var(--gold)' }}>{item.key}</code> · {item.description}
                  </div>
                </div>
              ),
            },
            {
              header: 'CATEGORY',
              accessor: (item) => <Badge label={item.category.toUpperCase()} variant="neutral" />,
            },
            {
              header: 'ROLLOUT',
              accessor: (item) => <strong>{item.rollout_percentage}% Global</strong>,
            },
            {
              header: 'STATE',
              accessor: (item) => (
                <Badge
                  label={item.global_enabled ? 'ENABLED' : 'DISABLED'}
                  variant={item.global_enabled ? 'active' : 'suspended'}
                  pulse={item.global_enabled}
                />
              ),
            },
            {
              header: 'TOGGLE',
              accessor: (item) => (
                <Toggle
                  label=""
                  checked={item.global_enabled}
                  onChange={() => toggleFlag(item.key)}
                />
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.key}
          emptyMessage="No feature flags match your search query."
        />
      </Card>
    </div>
  );
}
