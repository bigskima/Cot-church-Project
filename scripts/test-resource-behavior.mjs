import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const React = require('react');
const { create, act } = require('react-test-renderer');
const { transformSync } = require('@babel/core');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const { code } = transformSync(readFileSync(file, 'utf8'), {
    filename: file, configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-typescript', '@babel/plugin-transform-modules-commonjs'],
  });
  const localRequire = (name) => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const cache = load('apps/mobile/src/services/query-cache.ts');
const { useResource } = load('apps/mobile/src/hooks/use-resource.ts');
const { invalidateAfterMutation } = load('apps/mobile/src/services/resource-invalidation.ts');
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }

await test('realtime refresh preserves content and ignores cancelled responses', async () => {
  const requests=[]; let state; let mounts=0; let unmounts=0;
  function Player() { React.useEffect(() => { mounts++; return () => unmounts++; }, []); return null; }
  function Probe() {
    state=useResource('test:feed', () => { const p=deferred(); requests.push(p); return p.promise; });
    return state.data ? React.createElement(Player) : null;
  }
  let root;
  await act(async () => { root=create(React.createElement(Probe)); });
  await act(async () => requests[0].resolve({ likes: 1 }));
  assert.equal(mounts,1);
  await act(async () => cache.invalidate('test:'));
  assert.deepEqual(state.data,{likes:1});
  assert.equal(state.loading,false);
  assert.equal(state.refreshing,false);
  assert.equal(unmounts,0);
  await act(async () => cache.invalidate('test:'));
  await act(async () => requests[2].resolve({likes:2}));
  await act(async () => requests[1].resolve({likes:0}));
  assert.equal(state.data.likes,2);
  assert.equal(cache.cached('test:feed').likes,2);
  assert.equal(mounts,1);
  await act(async () => root.unmount());
});

await test('scope changes and sign out remove old data even when a loader ignores abort', async () => {
  cache.evict(); let state; const requests=[];
  function Probe({scope}) { state=useResource(scope, () => { const p=deferred();requests.push(p);return p.promise; }); return null; }
  let root;
  await act(async () => { root=create(React.createElement(Probe,{scope:'account:a'})); });
  await act(async () => requests[0].resolve(['private A']));
  await act(async () => root.update(React.createElement(Probe,{scope:'account:b'})));
  assert.equal(state.data,undefined);
  await act(async () => cache.evict());
  await act(async () => requests[1].resolve(['old B session']));
  assert.equal(cache.cached('account:b'),undefined);
  assert.equal(state.data,undefined);
  await act(async () => requests[2].resolve(['current B session']));
  assert.deepEqual(state.data,['current B session']);
  await act(async () => root.unmount());
});

await test('transient refresh failure retains content and manual refresh is visible', async () => {
  cache.evict(); cache.remember('retry:feed',['existing']); let state; const requests=[];
  function Probe() { state=useResource('retry:feed',()=>{ const p=deferred();requests.push(p);return p.promise; });return null; }
  let root; await act(async () => { root=create(React.createElement(Probe)); });
  await act(async () => requests[0].reject(new TypeError('offline')));
  assert.deepEqual(state.data,['existing']); assert.equal(state.loading,false); assert.equal(state.stale,true);
  await act(async () => state.refresh()); assert.equal(state.refreshing,true);
  await act(async () => requests[1].resolve(['updated'])); assert.equal(state.refreshing,false);
  await act(async () => root.unmount());
});

await test('successful reactions update dependent screens but playback progress does not reload them', () => {
  cache.evict(); cache.remember('reels:immersive:public',[{id:'reel',likes:1}]);
  cache.remember('playback:reels:public',[{url:'stable-video-url'}]);
  invalidateAfterMutation('engagement',JSON.stringify({action:'sync_playback'}));
  assert.equal(cache.cacheSnapshot('reels:immersive:public').stale,false);
  invalidateAfterMutation('engagement',JSON.stringify({action:'react'}));
  assert.equal(cache.cacheSnapshot('reels:immersive:public').stale,true);
  assert.equal(cache.cacheSnapshot('reels:immersive:public').value[0].likes,1);
  assert.equal(cache.cacheSnapshot('playback:reels:public').stale,false);
});
