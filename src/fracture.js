function rng(seed){let s=Number(seed)>>>0;return()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function clip(polygon,nx,ny,limit){const out=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[0]*nx+a[1]*ny-limit,db=b[0]*nx+b[1]*ny-limit;if(da<=1e-9)out.push(a.slice());if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
export function polygonArea(p){return Math.abs(p.reduce((a,v,i)=>a+v[0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*v[1],0))/2;}
function centroid(p){let x=0,y=0,a=0;for(let i=0;i<p.length;i++){const v=p[i],w=p[(i+1)%p.length],cross=v[0]*w[1]-w[0]*v[1];a+=cross;x+=(v[0]+w[0])*cross;y+=(v[1]+w[1])*cross;}return[x/(3*a),y/(3*a),0];}
export function fracturePanel({width=5,height=3.3,depth=.36,count=30,seed=42,impact=[.6,1.85]}={}){
  if(![width,height,depth].every(v=>Number.isFinite(v)&&v>0)||width>20||height>20||depth>4)throw new RangeError('Positive bounded panel dimensions required.');
  if(!Number.isInteger(count)||count<4||count>100||!Number.isFinite(seed)||!Array.isArray(impact)||impact.length!==2||!impact.every(Number.isFinite))throw new RangeError('Use 4–100 fragments, finite seed and a 2D impact point.');
  impact=[Math.max(-width/2+.04,Math.min(width/2-.04,impact[0])),Math.max(.04,Math.min(height-.04,impact[1]))];
  const random=rng(seed),seeds=[impact.slice()];
  for(let i=1;i<count;i++){let candidate;for(let tries=0;tries<30;tries++){if(i<count*.65){const theta=random()*Math.PI*2,r=Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.min(width,height)*.17;candidate=[Math.max(-width/2+.01,Math.min(width/2-.01,impact[0]+Math.cos(theta)*r)),Math.max(.01,Math.min(height-.01,impact[1]+Math.sin(theta)*r))];}else candidate=[(random()-.5)*width,random()*height];if(seeds.every(s=>Math.hypot(s[0]-candidate[0],s[1]-candidate[1])>.025))break;}seeds.push(candidate);}
  const fragments=[];
  for(let i=0;i<seeds.length;i++){
    let polygon=[[-width/2,0],[width/2,0],[width/2,height],[-width/2,height]];
    for(let j=0;j<seeds.length&&polygon.length>=3;j++){if(i===j)continue;const a=seeds[i],b=seeds[j];polygon=clip(polygon,b[0]-a[0],b[1]-a[1],(b[0]**2+b[1]**2-a[0]**2-a[1]**2)/2);}
    const area=polygonArea(polygon);if(polygon.length<3||area<1e-9)continue;
    const center=centroid(polygon),local=polygon.map(p=>[p[0]-center[0],p[1]-center[1]]),positions=[],normals=[],groups=[],uv=[];
    function triangle(a,b,c,material){const u=b.map((v,k)=>v-a[k]),v=c.map((q,k)=>q-a[k]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...normal);if(len<1e-12)return;groups.push({start:positions.length/3,count:3,materialIndex:material});for(const p of[a,b,c]){positions.push(...p);normals.push(...normal.map(n=>n/len));uv.push((p[0]+center[0]+width/2)/width,(p[1]+center[1])/height);}}
    const front=local.map(p=>[...p,depth/2]),back=local.map(p=>[...p,-depth/2]);
    for(let j=1;j<local.length-1;j++){triangle(front[0],front[j],front[j+1],0);triangle(back[0],back[j+1],back[j],0);}
    for(let j=0;j<local.length;j++){const k=(j+1)%local.length,a=polygon[j],b=polygon[k];const exterior=(Math.abs(a[0]+width/2)<1e-7&&Math.abs(b[0]+width/2)<1e-7)||(Math.abs(a[0]-width/2)<1e-7&&Math.abs(b[0]-width/2)<1e-7)||(Math.abs(a[1])<1e-7&&Math.abs(b[1])<1e-7)||(Math.abs(a[1]-height)<1e-7&&Math.abs(b[1]-height)<1e-7);triangle(back[j],back[k],front[k],exterior?0:1);triangle(back[j],front[k],front[j],exterior?0:1);}
    fragments.push({id:i,polygon,local,centroid:center,area,volume:area*depth,depth,positions,normals,uv,groups});
  }
  return {width,height,depth,seed,count:fragments.length,impact,seeds,fragments};
}
export function rotatePoint(v,q){const[x,y,z,w]=q,[vx,vy,vz]=v,tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);return[vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx];}
export function createBodies(fracture,{strength=3,seed=fracture.seed}={}){
  if(!Number.isFinite(strength)||strength<0||strength>12)throw new RangeError('Impact strength must be 0–12.');const random=rng(seed+19);
  return fracture.fragments.map(f=>{const dx=f.centroid[0]-fracture.impact[0],dy=f.centroid[1]-fracture.impact[1],distance=Math.hypot(dx,dy),falloff=.45+.55*Math.exp(-distance),radius=Math.max(...f.local.map(p=>Math.hypot(...p)));
    return {position:f.centroid.slice(),quaternion:[0,0,0,1],velocity:[dx/(distance+.2)*strength*.7,Math.max(-.4,dy/(distance+.2)*.55+.7)*strength*falloff,(.65+random()*.35)*strength*falloff],angular:[(random()-.5)*4,(random()-.5)*4,(random()-.5)*3],mass:Math.max(.05,f.volume),inertia:Math.max(.002,f.volume*(radius*radius+f.depth*f.depth)/4),fragment:f};});
}
export function stepBodies(bodies,dt,{floor=-.48,restitution=.23}={}){
  if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw new RangeError('Timestep must be positive and at most 1/30.');
  for(const b of bodies){b.velocity[1]-=9.81*dt;for(let k=0;k<3;k++){b.position[k]+=b.velocity[k]*dt;b.velocity[k]*=.999;b.angular[k]*=.997;}
    const[x,y,z,w]=b.quaternion,[wx,wy,wz]=b.angular,q=[x+dt*.5*(wx*w+wy*z-wz*y),y+dt*.5*(-wx*z+wy*w+wz*x),z+dt*.5*(wx*y-wy*x+wz*w),w-dt*.5*(wx*x+wy*y+wz*z)],ql=Math.hypot(...q);b.quaternion=q.map(v=>v/ql);
    const points=b.fragment.local.flatMap(v=>[-1,1].map(side=>rotatePoint([v[0],v[1],side*b.fragment.depth/2],b.quaternion)));let min=Infinity;for(const p of points)min=Math.min(min,p[1]);
    if(b.position[1]+min<floor){b.position[1]=floor-min;const contacts=points.filter(p=>p[1]<min+.008),r=contacts.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/contacts.length),[0,0,0]);const speed=b.velocity[1]+b.angular[2]*r[0]-b.angular[0]*r[2];
      if(speed<0){const impulse=-(1+restitution)*speed/(1/b.mass+(r[0]**2+r[2]**2)/b.inertia);b.velocity[1]+=impulse/b.mass;b.angular[0]-=r[2]*impulse/b.inertia;b.angular[2]+=r[0]*impulse/b.inertia;}
      b.velocity[0]*=.91;b.velocity[2]*=.91;for(let k=0;k<3;k++)b.angular[k]*=.83;if(Math.abs(b.velocity[1])<.08)b.velocity[1]=0;
    }
    for(let k=0;k<3;k++)b.angular[k]=Math.min(18,Math.max(-18,b.angular[k]));
  }
}
export function simulateFracture(fracture,{strength=3,seconds=4,fps=60,floor=-.48}={}){
  if(!Number.isFinite(seconds)||seconds<=0||seconds>8||fps!==60)throw new RangeError('Use up to eight seconds at 60fps.');const bodies=createBodies(fracture,{strength}),frames=[];
  const snapshot=()=>bodies.map(b=>({position:b.position.slice(),quaternion:b.quaternion.slice()}));frames.push(snapshot());
  for(let frame=0;frame<Math.round(seconds*fps);frame++){stepBodies(bodies,1/120,{floor});stepBodies(bodies,1/120,{floor});frames.push(snapshot());}
  return {frames,seconds,fps};
}
