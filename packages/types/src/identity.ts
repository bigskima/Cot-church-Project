export type IdentityCredentials = {
  email: string;
  phoneNumber?: never;
  password: string;
} | {
  email?: never;
  phoneNumber: string;
  password: string;
};

export type VerifyOtpRequest = {
  email: string;
  phoneNumber?: never;
  token: string;
  type: "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";
} | {
  email?: never;
  phoneNumber: string;
  token: string;
  type: "sms" | "phone_change";
};

export interface SessionContract {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  tokenType: string;
}

export interface LoginResponse {
  user: { id: string; email?: string; phoneNumber?: string };
  session: SessionContract;
}

export interface VerifyOtpResponse {
  status: "verified";
  userId: string;
  session: SessionContract | null;
}

export interface ProfileResponse {
  id: string;
  display_name: string;
  phone_number: string | null;
  avatar_url: string | null;
  email: string | null;
  verifiedPhoneNumber: string | null;
  created_at: string;
  updated_at: string;
}
