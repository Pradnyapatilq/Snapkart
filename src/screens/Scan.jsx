import {useEffect,useRef,useState,useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../services/api';
import {useApp} from '../context/AppContext';
import {Button,Icon,BottomSheet,QuantitySelector,Price} from '../components/ui';
import {clean} from '../utils/format';
// Scanner component: emits decoded barcode TEXT via onDetect. Uses native BarcodeDetector where available.
// To plug in another decoder (e.g. ZXing), replace the detect loop in useEffect; the onDetect contract stays.
export function Scanner({onDetect,paused,onClose}){
 const vid=useRef(),trk=useRef(),[err,setErr]=useState(''),[torch,setTorch]=useState(false),[manual,setManual]=useState(''),[native,setNative]=useState(true);
 useEffect(()=>{let stop=false,raf;(async()=>{
  try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});if(stop){s.getTracks().forEach(t=>t.stop());return}
   trk.current=s.getVideoTracks()[0];vid.current.srcObject=s;await vid.current.play();
   if(!('BarcodeDetector' in window)){setNative(false);return}
   const d=new window.BarcodeDetector();let last=0;
   const loop=async()=>{if(stop)return;const n=Date.now();if(!paused.current&&n-last>250){last=n;try{const r=await d.detect(vid.current);if(r[0]?.rawValue){navigator.vibrate?.(40);onDetect(r[0].rawValue)}}catch{}}raf=requestAnimationFrame(loop)};loop();
  }catch{setErr('Camera access is unavailable. Allow camera permission, or enter the barcode below.');setNative(false)}})();
  return()=>{stop=true;cancelAnimationFrame(raf);vid.current?.srcObject?.getTracks().forEach(t=>t.stop())}},[]);
 const flash=async()=>{try{await trk.current.applyConstraints({advanced:[{torch:!torch}]});setTorch(!torch)}catch{}};
 return <div className="cam"><video ref={vid} playsInline muted/><div className="ov">
  <div className="row sp"><button className="circ" aria-label="Close scanner" onClick={onClose}><Icon n="x"/></button><button className="circ" aria-label="Toggle flashlight" onClick={flash} style={torch?{background:'#fff',color:'#000'}:null}><Icon n="bolt"/></button></div>
  <div className="frame" aria-hidden="true"><i/><i/><i/><i/><u/></div>
  <div style={{textAlign:'center',display:'grid',gap:10}}><h2 className="h1">Scan a product</h2><p style={{opacity:.8}}>Align the barcode inside the frame</p>{err&&<p style={{color:'#FFD27A'}}>{err}</p>}
  {!native&&<form className="row" onSubmit={e=>{e.preventDefault();manual.trim()&&onDetect(manual.trim())}}><input className="inp" aria-label="Enter barcode" placeholder="Enter barcode, e.g. SNAPMOCK0001" value={manual} onChange={e=>setManual(e.target.value)}/><Button variant="sm" type="submit">Look up</Button></form>}</div></div></div>;
}
export default function Scan(){
 const nav=useNavigate(),{add,notify}=useApp(),paused=useRef(false),[state,setState]=useState('scan'),[p,setP]=useState(null),[q,setQ]=useState(1),[busy,setBusy]=useState(false),[err,setErr]=useState(null),[added,setAdded]=useState(false);
 const detect=useCallback(async code=>{if(paused.current)return;paused.current=true;setState('lookup');setErr(null);setAdded(false);setQ(1);
  try{const d=await api.byBarcode(code);setP(d.product);setState('found')}catch(e){setErr(e.message);setState('error')}},[]);
 const resume=()=>{setP(null);setErr(null);setState('scan');paused.current=false};
 const addIt=async()=>{setBusy(true);try{await add(p.barcode,q);notify('✓ Added to cart');setAdded(true)}catch(e){setErr(e.message);notify(e.message,true);if(e.code==='INSUFFICIENT_STOCK')setAdded(false)}finally{setBusy(false)}};
 const out=p&&(p.stock<=0||p.active===false);
 return <><Scanner onDetect={detect} paused={paused} onClose={()=>nav('/')}/>
 {state==='lookup'&&<div className="toast" style={{top:'auto',bottom:40}}><span className="spin"/> Looking up product...</div>}
 {state==='error'&&<BottomSheet onClose={resume}><h2 className="h1">Product not found</h2><p className="mut">{err}</p><Button onClick={resume}>Scan again</Button></BottomSheet>}
 {state==='found'&&p&&<BottomSheet onClose={resume}><span className="pill" style={{width:'fit-content'}}>{added?'Added to cart':'Product found'}</span>
  <div><h2 className="h1">{clean(p.name)}</h2><p className="mut">{[p.brand,p.category].filter(Boolean).map(clean).join(' · ')}</p></div>
  <div className="row sp"><Price minor={p.priceMinor} cur={p.currency} className="disp"/><span className={`pill ${out?'err':p.stock<=5?'warn':''}`}>{out?'Out of stock':p.stock<=5?`Only ${p.stock} left`:'In stock'}</span></div>
  {err&&<p className="ferr">{err}</p>}
  {!added?<><div className="row sp"><span style={{fontWeight:600}}>Quantity</span><QuantitySelector value={q} onChange={setQ} max={Math.max(1,p.stock||1)}/></div><Button loading={busy} disabled={out} onClick={addIt}>{busy?'Adding...':'Add to cart'}</Button><Button variant="sec2" onClick={resume}>Continue scanning</Button></>
  :<><Button onClick={()=>nav('/cart')}>View cart</Button><Button variant="sec2" onClick={resume}>Continue scanning</Button></>}</BottomSheet>}</>;
}
