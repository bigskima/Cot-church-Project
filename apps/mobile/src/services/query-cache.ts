type Entry<T>={value:T;storedAt:number};const memory=new Map<string,Entry<unknown>>();
export function cached<T>(key:string,maxAgeMs=300_000){const hit=memory.get(key) as Entry<T>|undefined;return hit&&Date.now()-hit.storedAt<maxAgeMs?hit.value:undefined}
export function remember<T>(key:string,value:T){memory.set(key,{value,storedAt:Date.now()})}
export function invalidate(prefix:string){for(const key of memory.keys())if(key.startsWith(prefix))memory.delete(key)}
