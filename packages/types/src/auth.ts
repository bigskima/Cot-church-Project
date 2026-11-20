export type SignupRequest = {
  email: string;
  phoneNumber?: never;
  password: string;
  displayName?: string;
} | {
  email?: never;
  phoneNumber: string;
  password: string;
  displayName?: string;
};

export interface SignupResponse {
  status: "active" | "verification_required";
}

export interface UserProfile {
  id: string;
  email?: string;
  phoneNumber?: string;
  displayName: string;
}
