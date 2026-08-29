import React, { useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, StatWidget, Table } from '../components/ui';

interface AiCapability {
  code: string;
  name: string;
  risk_level: 'low' | 'medium' | 'high' | 'pastoral';
  requires_human_review: boolean;
  description: string;
}

const capabilities: AiCapability[] = [
  { code: 'assistant.answer', name: 'Church Assistant', risk_level: 'medium', requires_human_review: false, description: 'Answer member questions from verified scripture & platform context.' },
  { code: 'sermon.transcribe', name: 'Sermon Audio Transcription', risk_level: 'medium', requires_human_review: false, description: 'Transcribe authorized sermon media recordings.' },
  { code: 'sermon.summarize', name: 'Sermon Intelligence & Notes', risk_level: 'medium', requires_human_review: true, description: 'Create scripture references, summaries, key lessons, and drafts.' },
  { code: 'live.caption', name: 'Live Stream Captions', risk_level: 'medium', requires_human_review: false, description: 'Produce live captions for active broadcast audio.' },
  { code: 'translate.text', name: 'Multilingual Translation', risk_level: 'medium', requires_human_review: false, description: 'Translate approved church announcements and sermons.' },
  { code: 'search.embed', name: 'Semantic Knowledge Embeddings', risk_level: 'low', requires_human_review: false, description: 'Generate vector embeddings for spiritual search.' },
  { code: 'content.moderate', name: 'Automated Moderation Suggestions', risk_level: 'high', requires_human_review: true, description: 'Screen social interactions and flag abusive content for human moderator.' },
  { code: 'pastoral.triage', name: 'Pastoral Follow-Up Classification', risk_level: 'pastoral', requires_human_review: true, description: 'Classify private prayer & altar responses for authorized minister review.' },
];

export function AiInfrastructure({ api }: { api: ApiClient }) {
  const [providers] = useState([
    {
      code: 'openai',
      name: 'OpenAI Gateway Adapter',
      models: ['gpt-4o', 'gpt-4o-mini', 'text-embedding-3-small'],
      status: 'active',
      secret_reference: 'OPENAI_API_KEY',
    },
    {
      code: 'gemini',
      name: 'Google Gemini Gateway Adapter',
      models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'text-embedding-004'],
      status: 'active',
      secret_reference: 'GEMINI_API_KEY',
    },
    {
      code: 'anthropic',
      name: 'Anthropic Claude Gateway Adapter',
      models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
      status: 'active',
      secret_reference: 'ANTHROPIC_API_KEY',
    },
  ]);

  return (
    <div>
      {/* AI Gateway KPI Bar */}
      <div className="admin-stats-grid">
        <StatWidget
          title="Multi-Model Routing"
          value="3 Adapters"
          subtitle="OpenAI, Gemini, Claude"
          trend={{ value: 'ACTIVE', isPositive: true }}
          icon="✦"
          variant="gold"
        />
        <StatWidget
          title="Inference Guardrails"
          value="Human Review"
          subtitle="Pastoral safety enforced"
          trend={{ value: 'STRICT', isPositive: true }}
          icon="🛡"
          variant="success"
        />
        <StatWidget
          title="Semantic Embeddings"
          value="text-embedding-3"
          subtitle="Global sermon vector store"
          trend={{ value: 'HEALTHY', isPositive: true }}
          icon="🧠"
        />
      </div>

      {/* Provider Registry Cards */}
      <Card
        title="AI Provider Adapters & Gateway Routing"
        subtitle="Provider-agnostic inference infrastructure with automatic failover and secret references"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {providers.map((p) => (
            <div
              key={p.code}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900 }}>{p.name}</h4>
                <Badge label={p.status.toUpperCase()} variant="active" pulse />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Secret Vault Ref: <strong style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>{p.secret_reference}</strong>
              </div>

              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>
                SUPPORTED MODELS:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {p.models.map((m, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-card)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>

              <Button variant="outline" size="sm" style={{ width: '100%' }}>
                Configure Routes & Quotas
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Capabilities & Human-in-the-loop Registry */}
      <Card
        title="Intelligence Capabilities & Pastoral Safety Matrix"
        subtitle="Policy-controlled AI services with required human review safeguards"
      >
        <Table
          columns={[
            {
              header: 'CAPABILITY CODE',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {item.code}
                  </div>
                </div>
              ),
            },
            {
              header: 'RISK TIER',
              accessor: (item) => (
                <Badge
                  label={item.risk_level.toUpperCase()}
                  variant={
                    item.risk_level === 'pastoral'
                      ? 'gold'
                      : item.risk_level === 'high'
                      ? 'warning'
                      : 'neutral'
                  }
                />
              ),
            },
            {
              header: 'HUMAN REVIEW POLICY',
              accessor: (item) =>
                item.requires_human_review ? (
                  <Badge label="MANDATORY HUMAN APPROVAL" variant="gold" />
                ) : (
                  <Badge label="AUTONOMOUS STREAM" variant="healthy" />
                ),
            },
            {
              header: 'PURPOSE / DESCRIPTION',
              accessor: 'description',
            },
          ]}
          data={capabilities}
          keyExtractor={(item) => item.code}
        />
      </Card>
    </div>
  );
}
