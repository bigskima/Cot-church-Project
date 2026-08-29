import * as SecureStore from 'expo-secure-store';
const SESSION_KEY='church-os-session';
export interface Session{accessToken:string;refreshToken:string;expiresAt?:number;tokenType:string}
export interface StoredAuth{session:Session;organizationId?:string;branchId?:string}
export async function loadAuth(){const value=await SecureStore.getItemAsync(SESSION_KEY);return value?JSON.parse(value) as StoredAuth:null;}
export async function saveAuth(value:StoredAuth|null){if(value)await SecureStore.setItemAsync(SESSION_KEY,JSON.stringify(value),{keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK});else await SecureStore.deleteItemAsync(SESSION_KEY);}
export class ApiError extends Error{constructor(public code:string,message:string,public status:number){super(message)}}
export class ApiClient{
 constructor(private baseUrl:string,private getAuth:()=>StoredAuth|null){}
 async request<T>(path:string,init:RequestInit={}){const auth=this.getAuth();const response=await fetch(`${this.baseUrl}/${path}`,{...init,headers:{Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...(auth?.session.accessToken?{Authorization:`Bearer ${auth.session.accessToken}`}:{ }),...(auth?.organizationId?{'X-Organization-Id':auth.organizationId}:{}),...(auth?.branchId?{'X-Branch-Id':auth.branchId}:{}),...init.headers}});const payload=await response.json();if(!response.ok)throw new ApiError(payload.error?.code??'REQUEST_FAILED',payload.error?.message??'Request failed',response.status);return payload.data as T;}
}
export const apiUrl=process.env.EXPO_PUBLIC_API_URL??'';
