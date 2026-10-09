import {useState} from 'react';
import {useNavigate,Link} from 'react-router-dom';
import {api} from '../services/api';
import {useApp} from '../context/AppContext';
import {Header,Button,Price,Icon,EmptyState} from '../components/ui';
import {clean,when,shortId} from '../utils/format';
const KEY='sk_idem';
const newKey=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export default function Checkout(){
 const {cart,loadCart}=useApp(),nav=useNavigate(),[st,setSt]=useState('review'),[order,setOrder]=useState(null),[err,setErr]=useState('');
 // Same idempotency key is reused for retries of the same attempt (network error / pending); cleared after a definitive result.
 const pay=async()=>{if(st==='processing')return;setSt('processing');setErr('');let k=sessionStorage.getItem(KEY);if(!k){k=newKey();sessionStorage.setItem(KEY,k)}
  try{const r=await api.checkout(k);const d=r.data||{};const o=d.order||d;setOrder(o);
   const s=String(o.paymentStatus||o.payment?.status||o.status||'').toUpperCase();
   if(r.status===202||/PEND|PROC/.test(s)){setSt('pending')}else{sessionStorage.removeItem(KEY);setSt('success');loadCart()}}
  catch(e){if(e.code==='PAYMENT_DECLINED'||e.status===409||e.status===400)sessionStorage.removeItem(KEY);setErr(e.message);setSt('failed');if(e.status===409)loadCart()}};
 const oid=order?.id;
 if(st==='success')return <div className="page" style={{textAlign:'center',paddingTop:72}}><div style={{width:72,height:72,borderRadius:'50%',background:'var(--acc)',color:'#fff',display:'grid',placeItems:'center',margin:'0 auto 20px',animation:'pop .4s'}}><Icon n="check" s={36}/></div><h1 className="h1">Payment successful</h1><p className="mut">Order confirmed</p>
  <div className="card gap" style={{margin:'24px 0',textAlign:'left'}}><div className="row sp"><span className="mut">Order ID</span><b>{shortId(oid)}</b></div><div className="row sp"><span className="mut">Total</span><Price minor={order.totalMinor??order.subtotalMinor} cur={order.currency}/></div><div className="row sp"><span className="mut">Date</span><span>{when(order.createdAt||Date.now())}</span></div></div>
  <div className="gap">{oid&&<Button onClick={()=>nav(`/bills/${oid}`)}>View bill</Button>}<Button variant="sec2" onClick={()=>nav('/')}>Done</Button></div></div>;
 if(st==='pending')return <div className="page" style={{textAlign:'center',paddingTop:72}}><span className="spin" style={{width:40,height:40,color:'var(--warn)'}}/><h1 className="h1" style={{marginTop:20}}>Payment pending</h1><p className="mut" style={{margin:'6px 0 24px'}}>We're confirming your payment. Please don't pay again.</p><Button onClick={()=>nav('/bills')}>View my bills</Button></div>;
 if(!cart?.items?.length)return <div className="page"><Header title="Checkout" back/><EmptyState title="Your cart is empty" text="Scan a product to get started." action="Start scanning" onAction={()=>nav('/scan')}/></div>;
 const cur=cart.items[0].currency;
 return <div className="page"><Header title="Review your purchase" back/>
 <div className="card gap">{cart.items.map(i=><div key={i.barcode} className="row sp"><span>{clean(i.name)} <span className="mut">× {i.quantity}</span></span><Price minor={i.lineTotalMinor} cur={cur}/></div>)}</div>
 <div className="card gap" style={{margin:'16px 0'}}><div className="row sp"><span className="mut">Subtotal</span><Price minor={cart.subtotalMinor} cur={cur}/></div><div className="row sp"><span className="h2">Total</span><Price minor={cart.subtotalMinor} cur={cur} className="h1"/></div></div>
 {st==='failed'&&<p className="ferr" role="alert" style={{marginBottom:12,fontSize:14}}>{err||'Payment could not be completed.'}</p>}
 <Button loading={st==='processing'} onClick={pay}>{st==='processing'?'Processing payment...':st==='failed'?'Try again':'Proceed to payment'}</Button>
 <p className="mut" style={{textAlign:'center',marginTop:12}}>Payments are processed securely. <Link to="/cart" style={{color:'var(--acc)'}}>Edit cart</Link></p></div>;
}
