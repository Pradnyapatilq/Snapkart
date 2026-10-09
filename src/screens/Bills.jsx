import {useEffect,useState,useCallback} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {api} from '../services/api';
import {Header,Price,Skeleton,EmptyState,ErrorState,StatusBadge} from '../components/ui';
import {when,dayKey,shortId,clean} from '../utils/format';
const useLoad=fn=>{const [s,set]=useState({loading:true});const go=useCallback(()=>{set({loading:true});fn().then(d=>set({d}),e=>set({e:e.message}))},[fn]);useEffect(go,[go]);return [s,go]};
const st=o=>o.paymentStatus||o.payment?.status||o.status||'PAID';
const tot=o=>o.totalMinor??o.subtotalMinor;
export function Bills(){
 const nav=useNavigate(),f=useCallback(()=>api.orders(),[]),[s,go]=useLoad(f);
 if(s.loading)return <div className="page"><Header title="My Bills"/><p className="mut" style={{marginTop:-12,marginBottom:12}}>Loading your bills...</p><Skeleton/></div>;
 if(s.e)return <div className="page"><Header title="My Bills"/><ErrorState text={s.e} onRetry={go}/></div>;
 const list=(Array.isArray(s.d)?s.d:s.d.orders||[]);
 if(!list.length)return <div className="page"><Header title="My Bills"/><EmptyState title="No bills yet" text="Your completed purchases will appear here." action="Start scanning" onAction={()=>nav('/scan')}/></div>;
 const g={};list.forEach(o=>(g[dayKey(o.createdAt)]??=[]).push(o));
 return <div className="page"><Header title="My Bills"/>{Object.entries(g).map(([k,os])=><section key={k} style={{marginBottom:20}}><p className="sec" style={{marginBottom:8}}>{k}</p><div className="gap">{os.map(o=><Link key={o.id} to={`/bills/${o.id}`} className="card row sp" style={{textDecoration:'none',color:'inherit'}}><div><b>Order #{shortId(o.id)}</b><p className="mut">{o.items?.reduce((n,i)=>n+i.quantity,0)??o.itemCount??''} items · {when(o.createdAt)}</p></div><div style={{textAlign:'right',display:'grid',gap:4}}><Price minor={tot(o)} cur={o.currency}/><StatusBadge s={st(o)}/></div></Link>)}</div></section>)}</div>;
}
export function BillDetail(){
 const {id}=useParams(),f=useCallback(()=>api.order(id),[id]),[s,go]=useLoad(f);
 if(s.loading)return <div className="page"><Header title="Bill" back/><Skeleton n={4}/></div>;
 if(s.e)return <div className="page"><Header title="Bill" back/><ErrorState text={s.e} onRetry={go}/></div>;
 const o=s.d.order||s.d;const cur=o.currency||o.items?.[0]?.currency;
 return <div className="page"><Header title={`Order #${shortId(o.id)}`} back/>
 <div className="card gap"><div className="row sp"><span className="mut">Date</span><span>{when(o.createdAt)}</span></div><div className="row sp"><span className="mut">Payment</span><StatusBadge s={st(o)}/></div></div>
 <p className="sec" style={{margin:'20px 0 8px'}}>Items</p><div className="card gap">{(o.items||[]).map((i,x)=><div key={x} className="row sp"><div><b>{clean(i.name)}</b><p className="mut">{i.quantity} × <Price minor={i.unitPriceMinor} cur={cur}/></p></div><Price minor={i.lineTotalMinor} cur={cur}/></div>)}</div>
 <div className="card gap" style={{marginTop:16}}><div className="row sp"><span className="mut">Subtotal</span><Price minor={o.subtotalMinor??tot(o)} cur={cur}/></div><div className="row sp"><span className="h2">Total</span><Price minor={tot(o)} cur={cur} className="h1"/></div></div></div>;
}
