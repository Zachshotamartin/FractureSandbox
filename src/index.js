import {fracturePanel,simulateFracture} from './fracture.js';
export {fracturePanel,simulateFracture,createBodies,stepBodies} from './fracture.js';
export const metadata={id:'fracture-sandbox',title:'Fracture Sandbox',description:'Choose an impact point, cut a solid panel into seeded Voronoi shards, and inspect the newly exposed interior faces through a reversible rigid-body flight.',technique:'Convex half-plane clipping · extruded Voronoi cells · rigid fragment contact',instructions:['Click the intact panel to place the impact, or use its horizontal and vertical controls.','Generate cuts after changing fragment count or seed. Fracture panel plays the computed trajectory.','Scrub time or reassemble to follow the exact motion backward.','Pause and separate cuts to inspect each cell; export the visible fragments as OBJ.'],limitations:['Voronoi cells are cut in 2D and extruded through a thin rectangular panel. This is not volumetric 3D fracture.','Fragments have gravity, rotation and vertex-based floor contact, but do not collide with one another.','Material presets change appearance. They do not model a material’s fracture toughness or crack propagation.']};
export function createExperiment(ctx){
  const {THREE:T,root,ui}=ctx;let count=30,seed=42,strength=3,appliedStrength=3,impact=[.6,1.85],time=0,playing=false,direction=1,separation=0,wire=false,fracture,motion,pieces=[],undo=[];const inputs={};
  const group=new T.Group();root.add(group);
  const dark=new T.MeshStandardMaterial({color:0x23372f,roughness:.85}),metal=new T.MeshStandardMaterial({color:0x879b92,roughness:.42,metalness:.72});
  function mesh(geometry,material,position,parent=root){const m=new T.Mesh(geometry,material);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  mesh(new T.BoxGeometry(8.7,.12,7.3),dark,[0,-.55,1.6]);
  for(const x of [-2.68,2.68]){mesh(new T.BoxGeometry(.09,3.8,.12),metal,[x,1.43,-.35]);mesh(new T.BoxGeometry(.5,.14,1.1),metal,[x,-.42,-.35]);}
  for(const y of [-.12,3.44])mesh(new T.BoxGeometry(5.5,.09,.12),metal,[0,y,-.35]);
  for(const x of [-2.67,2.67])for(const y of [0,3.3]){const bolt=mesh(new T.CylinderGeometry(.054,.054,.025,6),metal,[x,y,-.27]);bolt.rotation.x=Math.PI/2;}
  const floorLines=[];for(let x=-4;x<=4;x+=.5)floorLines.push(x,-.483,-2,x,-.483,5);for(let z=-2;z<=5;z+=.5)floorLines.push(-4,-.483,z,4,-.483,z);const grid=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(floorLines,3)),new T.LineBasicMaterial({color:0x587168,transparent:true,opacity:.2}));root.add(grid);
  function makeTexture(style){const c=document.createElement('canvas');c.width=1024;c.height=640;const g=c.getContext('2d');g.fillStyle=style==='Plaster'?'#d1c9b4':style==='Glass'?'#719eaa':'#527d83';g.fillRect(0,0,c.width,c.height);g.strokeStyle=style==='Plaster'?'rgba(66,65,53,.12)':'rgba(221,233,218,.3)';g.lineWidth=2;for(let x=0;x<=1024;x+=128){g.beginPath();g.moveTo(x,0);g.lineTo(x,640);g.stroke();}for(let y=0;y<=640;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(1024,y);g.stroke();}g.strokeStyle='rgba(236,234,207,.78)';g.lineWidth=3;g.strokeRect(24,24,976,592);g.fillStyle='#e7e8d5';g.font='600 46px sans-serif';g.fillText('IMPACT STUDY',58,89);g.font='24px monospace';g.fillText('SEEDED CELL STRUCTURE',60,128);g.fillText('01 / MATERIAL PANEL',60,584);g.lineWidth=2;for(let i=0;i<4;i++){g.beginPath();g.arc(770,280,38+i*25,0,Math.PI*2);g.stroke();}const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,ctx.renderer.capabilities.getMaxAnisotropy());return texture;}
  const faceMaterial=new T.MeshStandardMaterial({map:makeTexture('Ceramic'),roughness:.35,metalness:.09}),interiorMaterial=new T.MeshStandardMaterial({color:0xe0ad7c,roughness:.93}),edgeMaterial=new T.LineBasicMaterial({color:0xefd3a2,transparent:true,opacity:.65});
  const marker=new T.Group();root.add(marker);const markerMaterial=new T.MeshBasicMaterial({color:0xeaa780,depthTest:false});marker.add(new T.Mesh(new T.TorusGeometry(.13,.018,8,32),markerMaterial));marker.add(new T.Mesh(new T.SphereGeometry(.038,14,10),markerMaterial));marker.renderOrder=7;
  const scratch=new T.Vector3(),qa=new T.Quaternion(),qb=new T.Quaternion();
  function syncRange(input,value){input.value=value;const output=input.closest('label')?.querySelector('output');if(output)output.value=Number(value).toFixed(Number(input.step)>=1?0:2);}
  function render(){if(!motion)return;const f=Math.min(motion.frames.length-1,time*60),lo=Math.floor(f),hi=Math.min(motion.frames.length-1,lo+1),alpha=f-lo;
    pieces.forEach((piece,i)=>{const a=motion.frames[lo][i],b=motion.frames[hi][i];piece.position.set(...a.position).lerp(new T.Vector3(...b.position),alpha);qa.fromArray(a.quaternion);qb.fromArray(b.quaternion);piece.quaternion.copy(qa).slerp(qb,alpha);
      if(separation){const c=fracture.fragments[i].centroid;scratch.set(c[0]-fracture.impact[0],c[1]-fracture.impact[1],.25).normalize();piece.position.addScaledVector(scratch,separation);}
      piece.children[1].visible=wire||time>.02||separation>0;});
    marker.position.set(impact[0],impact[1],.215);marker.visible=time<.03&&!separation;ctx.invalidate();}
  function status(){ctx.setStatus(`${fracture.count} closed fragments · ${fracture.fragments.reduce((n,f)=>n+f.positions.length/9,0)} triangles · seed ${fracture.seed} · ${time.toFixed(2)}s${separation?' · separated inspection':''}`);}
  function build(remember=true){if(remember&&fracture){undo.push({count:fracture.count,seed:fracture.seed,impact:fracture.impact.slice(),strength:appliedStrength});if(undo.length>12)undo.shift();}playing=false;time=0;separation=0;for(const p of pieces){p.children.forEach(m=>m.geometry?.dispose());group.remove(p);}pieces=[];
    fracture=fracturePanel({count,seed,impact});motion=simulateFracture(fracture,{strength});appliedStrength=strength;
    for(const f of fracture.fragments){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(f.positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(f.normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(f.uv,2));let run=null;for(const g of f.groups){if(run&&run.materialIndex===g.materialIndex&&run.start+run.count===g.start)run.count+=g.count;else{if(run)geometry.addGroup(run.start,run.count,run.materialIndex);run={...g};}}if(run)geometry.addGroup(run.start,run.count,run.materialIndex);
      const piece=new T.Group(),solid=new T.Mesh(geometry,[faceMaterial,interiorMaterial]);solid.castShadow=true;solid.receiveShadow=true;solid.userData.fragment=f.id;piece.add(solid);piece.add(new T.LineSegments(new T.EdgesGeometry(geometry,25),edgeMaterial));piece.position.set(...f.centroid);group.add(piece);pieces.push(piece);}
    render();if(timeline)syncRange(timeline,0);if(explode)syncRange(explode,0);for(const[key,value]of Object.entries({count,seed,strength,x:impact[0],y:impact[1]}))if(inputs[key])syncRange(inputs[key],value);status();}
  let timeline,explode;build(false);
  ui.section('Where it breaks');
  inputs.x=ui.range('Horizontal impact',{min:-2.4,max:2.4,step:.01,value:impact[0],onChange:value=>{impact[0]=value;marker.position.set(impact[0],impact[1],.215);marker.visible=true;ctx.setStatus('Impact moved. Generate cuts to rebuild the geometry.');}});
  inputs.y=ui.range('Vertical impact',{min:.1,max:3.2,step:.01,value:impact[1],onChange:value=>{impact[1]=value;marker.position.set(impact[0],impact[1],.215);marker.visible=true;ctx.setStatus('Impact moved. Generate cuts to rebuild the geometry.');}});
  inputs.count=ui.range('Fragment count',{min:8,max:72,step:1,value:count,onChange:value=>{count=value;ctx.setStatus('Fragment count changed. Generate cuts to apply.');}});
  inputs.seed=ui.range('Seed',{min:1,max:100,step:1,value:seed,onChange:value=>{seed=value;ctx.setStatus('Seed changed. Generate cuts to apply.');}});
  inputs.strength=ui.range('Impact strength',{min:.5,max:5,step:.1,value:strength,onChange:value=>{strength=value;ctx.setStatus('Strength changed. Generate cuts to recompute motion.');}});
  ui.button('Generate cuts',()=>build());
  const play=ui.button('Fracture panel',()=>{if(time>=4)time=0;direction=1;playing=true;separation=0;syncRange(explode,0);ctx.invalidate();},{primary:true});
  ui.section('Inspect & replay');
  timeline=ui.range('Timeline (seconds)',{min:0,max:4,step:.01,value:0,onChange:value=>{playing=false;time=value;separation=0;if(explode)syncRange(explode,0);render();status();}});
  ui.button('Pause motion',()=>{playing=false;status();});
  ui.button('Reassemble',()=>{separation=0;syncRange(explode,0);direction=-1;playing=time>0;render();status();});
  explode=ui.range('Separate cuts (inspection)',{min:0,max:.7,step:.01,value:0,onChange:value=>{playing=false;time=0;syncRange(timeline,0);separation=value;render();status();}});
  ui.toggle('Show cut edges',false,value=>{wire=value;render();});
  ui.select('Surface appearance',['Ceramic','Plaster','Glass'],'Ceramic',name=>{faceMaterial.map.dispose();faceMaterial.map=makeTexture(name);faceMaterial.transparent=name==='Glass';faceMaterial.opacity=name==='Glass'?.67:1;faceMaterial.roughness=name==='Plaster'?.9:.35;faceMaterial.needsUpdate=true;interiorMaterial.color.set(name==='Glass'?0xb7d5d1:name==='Plaster'?0xe0d5bd:0xe0ad7c);ctx.invalidate();});
  ui.button('Undo generated cuts',()=>{const previous=undo.pop();if(previous){({count,seed,impact,strength}=previous);build(false);}});
  ui.note('Cells become smaller around the impact. Every shard has front, back and freshly cut side faces. Reassembly reverses the saved physical trajectory.');
  ui.section('Export');
  ui.button('Export visible fragments OBJ',()=>ctx.exportOBJ(group,'fractured-panel.obj'));
  ui.button('Export fracture JSON',()=>ctx.download('fracture-cells.json',JSON.stringify({version:1,seed:fracture.seed,impact:fracture.impact,width:fracture.width,height:fracture.height,depth:fracture.depth,fragments:fracture.fragments.map(f=>({id:f.id,centroid:f.centroid,polygon:f.polygon,area:f.area}))},null,2),'application/json'));
  ui.note('Floor contact uses rotated fragment vertices. Shard-to-shard contact and frame collisions are deliberately excluded from this bounded solver.');
  ctx.listen(ctx.canvas,'pointerdown',event=>{if(time>.025)return;const hits=ctx.pick(event,pieces.map(p=>p.children[0]));if(!hits.length)return;impact=[Math.max(-2.4,Math.min(2.4,hits[0].point.x)),Math.max(.1,Math.min(3.2,hits[0].point.y))];build();},{capture:true});
  ctx.onFrame(dt=>{if(!playing)return;time=Math.max(0,Math.min(4,time+dt*direction));if(time===0||time===4)playing=false;syncRange(timeline,time);render();if(!playing)status();});
  ctx.fit(root);return {dispose(){playing=false;}};
}
