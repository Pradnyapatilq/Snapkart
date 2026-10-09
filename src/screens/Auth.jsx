import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useApp} from '../context/AppContext';
import {Button,Input,Logo,Icon} from '../components/ui';
export default function Auth({mode}){
 const reg=mode==='register',{login,register}=useApp(),nav=useNavigate();
 const [f,setF]=useState({name:'',email:'',password:''}),[e,setE]=useState({}),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[show,setShow]=useState(false);
 const set=k=>v=>setF({...f,[k]:v.target.value});
 const submit=async ev=>{ev.preventDefault();const x={};
  if(reg&&!f.name.trim())x.name='Enter your full name';
  if(!f.email.trim())x.email='Enter your email';else if(!/^\S+@\S+\.\S+$/.test(f.email))x.email='Enter a valid email address';
  if(!f.password)x.password='Enter your password';else if(reg&&f.password.length<8)x.password='Use at least 8 characters';
  setE(x);setErr('');if(Object.keys(x).length)return;setBusy(true);
  try{reg?await register({name:f.name.trim(),email:f.email.trim(),password:f.password}):await login({email:f.email.trim(),password:f.password});nav('/',{replace:true})}
  catch(er){setErr(er.message)}finally{setBusy(false)}};
 return <div className="page" style={{paddingTop:56}}><Logo size={44}/><h1 className="disp" style={{margin:'32px 0 6px'}}>{reg?'Create your account':'Welcome back'}</h1><p className="mut" style={{marginBottom:28}}>{reg?'Start scanning in under a minute.':'Sign in to continue shopping.'}</p>
 <form onSubmit={submit} noValidate>{reg&&<Input label="Full name" value={f.name} onChange={set('name')} error={e.name} autoComplete="name"/>}
 <Input label="Email" type="email" value={f.email} onChange={set('email')} error={e.email} autoComplete="email"/>
 <div style={{position:'relative'}}><Input label="Password" type={show?'text':'password'} value={f.password} onChange={set('password')} error={e.password} autoComplete={reg?'new-password':'current-password'}/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)} style={{position:'absolute',right:6,top:26,width:40,height:44,border:0,background:'none',color:'var(--mut)'}}><Icon n="eye"/></button></div>
 {err&&<p className="ferr" role="alert" style={{marginBottom:12,fontSize:14}}>{err}</p>}
 <Button type="submit" loading={busy}>{busy?(reg?'Creating account...':'Signing you in...'):reg?'Create Account':'Sign In'}</Button></form>
 <p className="mut" style={{textAlign:'center',marginTop:22}}>{reg?'Already have an account? ':'New to SnapKart? '}<Link to={reg?'/login':'/register'} style={{color:'var(--acc)',fontWeight:600}}>{reg?'Sign in':'Create account'}</Link></p></div>;
}
