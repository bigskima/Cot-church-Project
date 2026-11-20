export type GivingScope = 'church' | 'expression';

export type GivingSettings = {
  id: string;
  displayTitle: string;
  displaySubtitle: string;
  isEnabled: boolean;
  manualTransferEnabled: boolean;
  onlinePaymentEnabled: boolean;
  onlineUnavailableMessage: string;
};

export type GivingPurpose = {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'archived';
  display_order: number;
  is_default: boolean;
};

export type GivingCampaign = {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  name: string;
  description: string;
  currency: string;
  goal_amount_minor?: number | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  starts_at?: string | null;
  ends_at?: string | null;
};

export type BankAccount = {
  id: string;
  organization_id: string;
  branch_id?: string | null;
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

export type PublicGivingDetails = {
  scope: GivingScope;
  organization: { id: string; name: string };
  expression: { id: string; name: string } | null;
  settings: GivingSettings | null;
  purposes: GivingPurpose[];
  campaigns: GivingCampaign[];
  bankAccounts: BankAccount[];
  currencies: string[];
  methods: {
    manualBankTransfer: boolean;
    onlinePayment: boolean;
  };
};

export type ExpressionGivingConfiguration = {
  settings: {
    id: string;
    display_title: string;
    display_subtitle: string;
    is_enabled: boolean;
    manual_transfer_enabled: boolean;
    online_payment_enabled: boolean;
    online_unavailable_message: string;
  } | null;
  purposes: GivingPurpose[];
  bankAccounts: BankAccount[];
  campaigns: GivingCampaign[];
};
