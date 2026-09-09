import test from 'node:test';import assert from 'node:assert/strict';
import {fracturePanel,polygonArea,simulateFracture,rotatePoint} from '../src/fracture.js';
test('Voronoi fragments conserve panel area and produce closed triangulated cut faces',()=>{
  const result=fracturePanel({count:32,width:5,height:3,depth:.4});assert.equal(result.count,32);
  assert.ok(Math.abs(result.fragments.reduce((sum,f)=>sum+polygonArea(f.polygon),0)-15)<1e-7);
  for(const f of result.fragments){assert.ok(f.area>0);assert.equal(f.positions.length,f.normals.length);assert.ok(f.groups.some(g=>g.materialIndex===1));const edges=new Map();for(let i=0;i<f.positions.length;i+=9){const p=[0,1,2].map(k=>f.positions.slice(i+k*3,i+k*3+3).map(v=>v.toFixed(7)).join(','));for(let j=0;j<3;j++){const key=[p[j],p[(j+1)%3]].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}}assert.ok([...edges.values()].every(v=>v===2),'Every triangulated edge has two incident faces');}
});
test('seed reproducible, impact position changes actual cut geometry',()=>{
  const a=fracturePanel({seed:12,impact:[1,2]}),b=fracturePanel({seed:12,impact:[1,2]}),c=fracturePanel({seed:12,impact:[-1,.8]});assert.deepEqual(a,b);assert.notDeepEqual(a.fragments[0].polygon,c.fragments[0].polygon);
});
test('rigid motion is finite and vertex-level floor contact prevents penetration',()=>{
  const result=fracturePanel({count:16}),sim=simulateFracture(result,{strength:3,seconds:3});assert.equal(sim.frames.length,181);
  for(const frame of sim.frames)for(let i=0;i<frame.length;i++){const state=frame[i],fragment=result.fragments[i];assert.ok([...state.position,...state.quaternion].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...state.quaternion)-1)<1e-8);for(const v of fragment.local)for(const side of[-1,1])assert.ok(state.position[1]+rotatePoint([...v,side*fragment.depth/2],state.quaternion)[1]>=-.48001);}
});
test('reassembly frame exactly retains original centroids and orientations',()=>{
  const result=fracturePanel({count:8}),sim=simulateFracture(result,{seconds:.2});sim.frames[0].forEach((state,i)=>{assert.deepEqual(state.position,result.fragments[i].centroid);assert.deepEqual(state.quaternion,[0,0,0,1]);});
});
test('invalid size, seed and simulation input fail before geometry is produced',()=>{assert.throws(()=>fracturePanel({count:1}));assert.throws(()=>fracturePanel({seed:NaN}));assert.throws(()=>simulateFracture(fracturePanel(),{seconds:99}));});
