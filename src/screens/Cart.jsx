import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useApp} from '../context/AppContext';
import {Header,Button,Price,QuantitySelector,EmptyState,Skeleton,Icon} from '../components/ui';
import {clean} from '../utils/format';
export default function Cart(){
 const {cart,setQty,remove,notify,count}=useApp(),nav=useNavigate(),[busy,setBusy]=useState(null);
 const run=async(id,fn)=>{setBusy(id);try{await fn()}catch(e){notify(e.message,true)}finally{setBusy(null)}};
 if(!cart)return <div className="page"><Header title="My Cart"/><Skeleton/></div>;
 if(!cart.items?.length)return <div className="page"><Header title="My Cart"/><EmptyState title="Your cart is empty" text="Scan your first product to get started." action="Start scanning" onAction={()=>nav('/scan')}/></div>;
 return <div className="page"><Header title="My Cart"/><p className="mut" style={{marginTop:-12,marginBottom:14}}>{count} item{count>1?'s':''}</p>
 <div className="gap">{cart.items.map(i=><div key={i.productId||i.barcode} className="card gap" style={{opacity:busy===i.barcode?.6:1}}>
  <div className="row sp"><div><h3 className="h2">{clean(i.name)}</h3><p className="mut"><Price minor={i.unitPriceMinor} cur={i.currency}/> each</p></div><button aria-label={`Remove ${clean(i.name)}`} className="circ" style={{background:'none',color:'var(--mut)'}} onClick={()=>run(i.barcode,()=>remove(i.barcode))}><Icon n="trash"/></button></div>
  <div className="row sp"><QuantitySelector value={i.quantity} busy={busy===i.barcode} onChange={q=>run(i.barcode,()=>setQty(i.barcode,q))}/><Price minor={i.lineTotalMinor} cur={i.currency} className="h2"/></div></div>)}</div>
 {busy&&<p className="mut" style={{marginTop:12}}>Updating cart...</p>}
 <div className="card row sp" style={{margin:'16px 0'}}><span className="h2">Subtotal</span><Price minor={cart.subtotalMinor} cur={cart.items[0].currency} className="h1"/></div>
 <Button onClick={()=>nav('/checkout')}>Checkout</Button></div>;
}
