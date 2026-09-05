import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SelectField, Tabs, Toggle } from '../components/ui';

type Organization = { id: string; name: string; slug: string; status: string };
type Settings = {
  id: string;
  organization_id: string;
  display_title: string;
  display_subtitle: string;
  is_enabled: boolean;
  manual_transfer_enabled: boolean;
  online_payment_enabled: boolean;
  online_unavailable_message: string;
};
type Purpose = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'archived';
  display_order: number;
  is_default: boolean;
};
type Account = {
  id: string;
  organization_id: string;
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing_number?: string | null;
  swift_code?: string | null;
  iban?: string | null;
  currency: string;
  transfer_instructions: string;
  additional_instructions: string;
  reference_prefix?: string | null;
  is_public: boolean;
  is_active: boolean;
  display_order: number;
};
type Payload = {
  organizations: Organization[];
  settings: Settings[];
  purposes: Purpose[];
  bankAccounts: Account[];
  onlinePaymentsAvailable: boolean;
};

type Tab = 'settings' | 'purposes' | 'accounts';

export function GivingConfiguration({ api }: { api: ApiClient }) {
  const [data, setData] = useState<Payload>({
    organizations: [],
    settings: [],
    purposes: [],
    bankAccounts: [],
    onlinePaymentsAvailable: false,
  });
  const [organizationId, setOrganizationId] = useState('');
  const [tab, setTab] = useState<Tab>('settings');
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');

  const [displayTitle, setDisplayTitle] = useState('Giving');
  const [displaySubtitle, setDisplaySubtitle] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [manualEnabled, setManualEnabled] = useState(true);

  const [purposeName, setPurposeName] = useState('');
  const [purposeDescription, setPurposeDescription] = useState('');
  const [purposeDefault, setPurposeDefault] = useState(false);

  const [accountLabel, setAccountLabel] = useState('');
  const [currency, setCurrency] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [iban, setIban] = useState('');
  const [transferInstructions, setTransferInstructions] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [referencePrefix, setReferencePrefix] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await api.request<Payload>('platform-giving');
      setData(payload);
      setOrganizationId((current) => current || payload.organizations[0]?.id || '');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load church-wide giving configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [api]);

  const settings = useMemo(
    () => data.settings.find((item) => item.organization_id === organizationId) ?? null,
    [data.settings, organizationId],
  );
  const purposes = useMemo(
    () => data.purposes.filter((item) => item.organization_id === organizationId),
    [data.purposes, organizationId],
  );
  const accounts = useMemo(
    () => data.bankAccounts.filter((item) => item.organization_id === organizationId),
    [data.bankAccounts, organizationId],
  );
  const selectedOrganization = data.organizations.find((item) => item.id === organizationId) ?? null;

  useEffect(() => {
    if (!settings) {
      setDisplayTitle('Giving');
      setDisplaySubtitle('');
      setIsEnabled(true);
      setManualEnabled(true);
      return;
    }
    setDisplayTitle(settings.display_title);
    setDisplaySubtitle(settings.display_subtitle);
    setIsEnabled(settings.is_enabled);
    setManualEnabled(settings.manual_transfer_enabled);
  }, [settings?.id, organizationId]);

  const requireReason = () => {
    if (!reason.trim()) {
      setError('Enter a governance reason before changing church-wide giving configuration.');
      return null;
    }
    return reason.trim();
  };

  const mutate = async (body: Record<string, unknown>, success: string) => {
    const governanceReason = requireReason();
    if (!governanceReason || !organizationId) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.request('platform-giving', {
        method: 'PATCH',
        body: JSON.stringify({ ...body, organizationId, reason: governanceReason }),
      });
      setNotice(success);
      setReason('');
      await load();
      return true;
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update church-wide giving.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = () =>
    mutate(
      {
        action: 'upsert_settings',
        displayTitle: displayTitle.trim() || 'Giving',
        displaySubtitle: displaySubtitle.trim(),
        isEnabled,
        manualTransferEnabled: manualEnabled,
        onlinePaymentEnabled: false,
        onlineUnavailableMessage: 'Online giving is not available yet.',
      },
      'Church-wide giving settings saved.',
    );

  const addPurpose = async () => {
    if (!purposeName.trim()) {
      setError('Enter a purpose or fund name.');
      return;
    }
    const saved = await mutate(
      {
        action: 'upsert_purpose',
        name: purposeName.trim(),
        description: purposeDescription.trim(),
        status: 'active',
        isDefault: purposeDefault,
      },
      'Church-wide giving purpose published.',
    );
    if (saved) {
      setPurposeName('');
      setPurposeDescription('');
      setPurposeDefault(false);
      setPurposeOpen(false);
    }
  };

  const updatePurpose = (purpose: Purpose, patch: Partial<Pick<Purpose, 'status' | 'is_default'>>) =>
    mutate(
      {
        action: 'upsert_purpose',
        id: purpose.id,
        name: purpose.name,
        description: purpose.description,
        status: patch.status ?? purpose.status,
        displayOrder: purpose.display_order,
        isDefault: patch.is_default ?? purpose.is_default,
      },
      'Giving purpose updated.',
    );

  const addAccount = async () => {
    const code = currency.trim().toUpperCase();
    if (!accountLabel.trim() || !bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setError('Display label, bank name, account name, and account number are required.');
      return;
    }
    if (!/^[A-Z]{3}$/.test(code)) {
      setError('Currency must be a 3-letter code such as NGN, USD, GBP, EUR or CAD.');
      return;
    }
    const saved = await mutate(
      {
        action: 'upsert_bank_account',
        label: accountLabel.trim(),
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        routingNumber: routingNumber.trim() || undefined,
        swiftCode: swiftCode.trim() || undefined,
        iban: iban.trim() || undefined,
        currency: code,
        transferInstructions: transferInstructions.trim(),
        additionalInstructions: additionalInstructions.trim(),
        referencePrefix: referencePrefix.trim() || undefined,
        isPublic: true,
        isActive: true,
      },
      `${code} church-wide transfer account published.`,
    );
    if (saved) {
      setAccountLabel('');
      setCurrency('');
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      setRoutingNumber('');
      setSwiftCode('');
      setIban('');
      setTransferInstructions('');
      setAdditionalInstructions('');
      setReferencePrefix('');
      setAccountOpen(false);
    }
  };

  const setAccountActive = (account: Account, active: boolean) =>
    mutate(
      {
        action: 'upsert_bank_account',
        id: account.id,
        label: account.label,
        bankName: account.bank_name,
        accountName: account.account_name,
        accountNumber: account.account_number,
        routingNumber: account.routing_number || undefined,
        swiftCode: account.swift_code || undefined,
        iban: account.iban || undefined,
        currency: account.currency,
        transferInstructions: account.transfer_instructions,
        additionalInstructions: account.additional_instructions,
        referencePrefix: account.reference_prefix || undefined,
        isPublic: account.is_public,
        isActive: active,
        displayOrder: account.display_order,
      },
      active ? 'Transfer account published.' : 'Transfer account hidden.',
    );

  const organizationOptions = data.organizations.map((organization) => ({
    value: organization.id,
    label: `${organization.name}${organization.status !== 'active' ? ` (${organization.status})` : ''}`,
  }));

  return (
    <div className="admin-page-stack">
      {error && !purposeOpen && !accountOpen ? <div className="admin-inline-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-status-message admin-status-success">{notice}</div> : null}

      <Card
        title="Church-wide giving"
        subtitle="Configure the general church giving destination shown to guests and authenticated users. Expression giving remains controlled inside each Expression."
        headerAction={<Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button>}
      >
        <div className="admin-filter-bar">
          <SelectField
            label="Church organization"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            options={organizationOptions.length ? organizationOptions : [{ value: '', label: 'No organizations available' }]}
          />
          <InputField
            label="Governance reason for next change"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this church-wide giving configuration being changed?"
            helperText="Every write on this page is permission checked and audited."
          />
        </div>

        {selectedOrganization ? (
          <div className="admin-scope-banner">
            <Badge label={selectedOrganization.status.toUpperCase()} variant={selectedOrganization.status === 'active' ? 'active' : 'suspended'} />
            <div>
              <strong>{selectedOrganization.name}</strong>
              <span>Church-wide root scope only · no Expression account is editable from this page</span>
            </div>
          </div>
        ) : null}
      </Card>

      <Tabs
        tabs={[
          { key: 'settings', label: 'Availability & copy' },
          { key: 'purposes', label: 'Purposes & funds', count: purposes.length },
          { key: 'accounts', label: 'Transfer accounts', count: accounts.length },
        ]}
        activeKey={tab}
        onChange={(key) => setTab(key as Tab)}
      />

      {tab === 'settings' ? (
        <Card
          title="Giving availability & presentation"
          subtitle="Manual transfer is the active production rail. Online provider payments remain unavailable until an explicitly released production provider rollout."
        >
          <div className="admin-form-grid-two">
            <InputField label="Giving title" value={displayTitle} onChange={(event) => setDisplayTitle(event.target.value)} placeholder="Giving" />
            <InputField label="Giving description" value={displaySubtitle} onChange={(event) => setDisplaySubtitle(event.target.value)} placeholder="Optional message shown to givers" />
          </div>
          <div className="admin-settings-list">
            <Toggle
              label="Publish church-wide giving"
              description="Makes configured church-wide giving information available to guests and authenticated users."
              checked={isEnabled}
              onChange={setIsEnabled}
            />
            <Toggle
              label="Manual bank transfer"
              description="Shows active church-wide transfer accounts."
              checked={manualEnabled}
              onChange={setManualEnabled}
            />
            <Toggle
              label="Online payment"
              description="Unavailable by design until a verified production payment provider rollout is released."
              checked={false}
              onChange={() => undefined}
              disabled
            />
          </div>
          <div className="admin-card-footer-action">
            <Button onClick={() => void saveSettings()} loading={busy} disabled={!organizationId}>Save church-wide giving</Button>
          </div>
        </Card>
      ) : null}

      {tab === 'purposes' ? (
        <Card
          title="Configured church-wide purposes"
          subtitle={`${purposes.length} purpose${purposes.length === 1 ? '' : 's'} configured for this church. Purposes are data-driven and can be changed without redeploying the app.`}
          headerAction={<Button variant="gold" size="sm" onClick={() => { setError(''); setPurposeOpen(true); }}>New purpose</Button>}
        >
          {purposes.length ? (
            <div className="admin-record-grid">
              {purposes.map((purpose) => (
                <div key={purpose.id} className="admin-record-card">
                  <div className="admin-record-main">
                    <div className="admin-record-title-row">
                      <strong>{purpose.name}</strong>
                      {purpose.is_default ? <Badge label="DEFAULT" variant="gold" /> : null}
                      <Badge label={purpose.status.toUpperCase()} variant={purpose.status === 'active' ? 'active' : 'neutral'} />
                    </div>
                    {purpose.description ? <div className="admin-row-meta">{purpose.description}</div> : null}
                  </div>
                  <div className="admin-table-actions">
                    {!purpose.is_default && purpose.status === 'active' ? (
                      <Button variant="outline" size="sm" onClick={() => void updatePurpose(purpose, { is_default: true })} disabled={busy}>Set default</Button>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => void updatePurpose(purpose, { status: purpose.status === 'active' ? 'inactive' : 'active' })} disabled={busy}>
                      {purpose.status === 'active' ? 'Hide' : 'Publish'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="admin-table-empty"><p>No church-wide giving purposes are configured.</p></div>}
        </Card>
      ) : null}

      {tab === 'accounts' ? (
        <Card
          title="Published transfer destinations"
          subtitle={`${accounts.length} manual transfer account${accounts.length === 1 ? '' : 's'} configured. Currency remains data, not application code.`}
          headerAction={<Button variant="gold" size="sm" onClick={() => { setError(''); setAccountOpen(true); }}>New transfer account</Button>}
        >
          {accounts.length ? (
            <div className="admin-record-grid admin-record-grid-wide">
              {accounts.map((account) => (
                <div key={account.id} className="admin-record-card">
                  <div className="admin-record-main">
                    <div className="admin-record-title-row">
                      <strong>{account.label}</strong>
                      <Badge label={account.currency} variant="gold" />
                      <Badge label={account.is_active ? 'PUBLISHED' : 'HIDDEN'} variant={account.is_active ? 'active' : 'neutral'} />
                    </div>
                    <div className="admin-record-detail">{account.bank_name}</div>
                    <div className="admin-row-meta">{account.account_name}</div>
                    <code className="admin-account-number">{account.account_number}</code>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void setAccountActive(account, !account.is_active)} disabled={busy}>
                    {account.is_active ? 'Hide account' : 'Publish account'}
                  </Button>
                </div>
              ))}
            </div>
          ) : <div className="admin-table-empty"><p>No manual transfer accounts are configured yet.</p></div>}
        </Card>
      ) : null}

      <Modal
        isOpen={purposeOpen}
        onClose={() => { if (!busy) setPurposeOpen(false); }}
        title="New giving purpose"
        subtitle={selectedOrganization?.name}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" disabled={busy} onClick={() => setPurposeOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={busy} onClick={() => void addPurpose()}>Publish purpose</Button>
          </>
        }
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <InputField label="Purpose or fund name" value={purposeName} onChange={(event) => setPurposeName(event.target.value)} placeholder="General offering, missions, building fund…" />
          <InputField label="Description" value={purposeDescription} onChange={(event) => setPurposeDescription(event.target.value)} placeholder="Optional explanation" />
          <Toggle label="Default purpose" description="Preselect this purpose when someone opens church-wide giving." checked={purposeDefault} onChange={setPurposeDefault} />
          <div className="admin-info-callout">The governance reason entered at the top of this page will be attached to this audited change.</div>
        </div>
      </Modal>

      <Modal
        isOpen={accountOpen}
        onClose={() => { if (!busy) setAccountOpen(false); }}
        title="New transfer account"
        subtitle={selectedOrganization?.name}
        maxWidth="xl"
        footer={
          <>
            <Button variant="outline" disabled={busy} onClick={() => setAccountOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={busy} onClick={() => void addAccount()}>Publish transfer account</Button>
          </>
        }
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <div className="admin-form-grid-two">
            <InputField label="Display label" value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder="NGN General Giving" />
            <InputField label="Currency code" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} placeholder="NGN" />
            <InputField label="Bank name" value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Bank name" />
            <InputField label="Account name" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Beneficiary name" />
            <InputField label="Account number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="Account number" />
            <InputField label="Routing / sort code" value={routingNumber} onChange={(event) => setRoutingNumber(event.target.value)} placeholder="Optional" />
            <InputField label="SWIFT / BIC" value={swiftCode} onChange={(event) => setSwiftCode(event.target.value)} placeholder="Optional" />
            <InputField label="IBAN" value={iban} onChange={(event) => setIban(event.target.value)} placeholder="Optional" />
            <InputField label="Reference prefix" value={referencePrefix} onChange={(event) => setReferencePrefix(event.target.value)} placeholder="Optional, e.g. GIVE-" />
            <InputField label="Transfer instructions" value={transferInstructions} onChange={(event) => setTransferInstructions(event.target.value)} placeholder="Instructions shown to the giver" />
            <InputField label="Additional instructions" value={additionalInstructions} onChange={(event) => setAdditionalInstructions(event.target.value)} placeholder="Optional currency or bank-specific information" />
          </div>
          <div className="admin-info-callout">The governance reason entered at the top of this page will be attached to this audited change.</div>
        </div>
      </Modal>
    </div>
  );
}
