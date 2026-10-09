import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../services/api';
import {useApp} from '../context/AppContext';
import {Header,Button,Input,Price,Skeleton,EmptyState,ErrorState,Icon} from '../components/ui';
import {clean} from '../utils/format';
export function Search(){
 const [q,setQ]=useState(''),[items,setItems]=useState([]),[page,setPage]=useState(1),[more,setMore]=useState(false),[load,setLoad]=useState(true),[err,setErr]=useState('');
 const fetchP=async(p,reset)=>{setLoad(true);setErr('');try{const d=await api.products(q,p,20);const l=d.products||d.items||[];setItems(r=>reset?l:[...r,...l]);setMore(l.length===20);setPage(p)}catch(e){setErr(e.message)}finally{setLoad(false)}};
 useEffect(()=>{const t=setTimeout(()=>fetchP(1,true),300);return()=>clearTimeout(t)},[q]);
 return <div className="page"><Header title="Search" back/><Input label="Search products" value={q} onChange={e=>setQ(e.target.value)} placeholder="Milk, bread, snacks..." type="search"/>
 {err?<ErrorState text={err} onRetry={()=>fetchP(1,true)}/>:<div className="gap">{items.map(p=><div key={p.id} className="card row sp"><div><b>{clean(p.name)}</b><p className="mut">{[p.brand,p.category].filter(Boolean).map(clean).join(' · ')}</p></div><Price minor={p.priceMinor} cur={p.currency}/></div>)}</div>}
 {load&&<div style={{marginTop:12}}><Skeleton n={items.length?1:4}/></div>}
 {!load&&!err&&!items.length&&<EmptyState title="No products found" text="Try another search."/>}
 {!load&&more&&<Button variant="sec2" style={{marginTop:12}} onClick={()=>fetchP(page+1)}>Load more</Button>}</div>;
}
export function Profile(){
 const {user,logout}=useApp(),nav=useNavigate();
 return <div className="page"><Header title="Profile"/><div className="card gap"><div><p className="sec">Name</p><b>{clean(user?.name)}</b></div><div><p className="sec">Email</p><b>{clean(user?.email)}</b></div></div>
 <div className="gap" style={{marginTop:16}}><Button variant="sec2" onClick={()=>nav('/bills')}>My Bills</Button><Button variant="sec2" onClick={()=>nav('/help')}>Help</Button><Button variant="sec2" onClick={()=>{logout();nav('/login')}}><Icon n="out"/>Sign out</Button></div></div>;
}
export function Help(){
 const F=[['How do I scan a product?','Tap Start Scanning, allow camera access, and align the barcode inside the frame.'],['The barcode will not scan','Turn on the flashlight, hold steady, or enter the barcode manually.'],['My payment is pending','We are confirming it. Do not pay again; check My Bills shortly.'],['Can I change quantities?','Yes, from the product sheet or your cart.']];
 return <div className="page"><Header title="Help" back/><div className="gap">{F.map(([q,a])=><div key={q} className="card"><h3 className="h2">{q}</h3><p className="mut" style={{marginTop:4}}>{a}</p></div>)}</div></div>;
}
export const StoreMap=()=><div className="page"><Header title="Store Map" back/><EmptyState title="Store map coming soon" text="Aisle navigation will be available at participating stores."/></div>;
