import {createContext,useContext,useState,useEffect,useCallback} from 'react';
import {api,tokenStore} from '../services/api';
const Ctx=createContext();export const useApp=()=>useContext(Ctx);
export function AppProvider({children}){
 const [user,setUser]=useState(null),[ready,setReady]=useState(false),[cart,setCart]=useState(null),[toast,setToast]=useState(null);
 const notify=useCallback((msg,err)=>{setToast({msg,err});setTimeout(()=>setToast(null),2600)},[]);
 const loadCart=useCallback(async()=>{try{setCart(await api.cart())}catch{}},[]);
 const logout=useCallback(()=>{tokenStore.set(null);setUser(null);setCart(null)},[]);
 useEffect(()=>{(async()=>{if(tokenStore.get()){try{const d=await api.me();setUser(d.user||d);await loadCart()}catch{tokenStore.set(null)}}setTimeout(()=>setReady(true),1400)})()},[loadCart]);
 useEffect(()=>{const f=()=>{setUser(null);setCart(null);notify('Your session has expired. Please sign in again.',true)};window.addEventListener('sk:unauthorized',f);return()=>window.removeEventListener('sk:unauthorized',f)},[notify]);
 const authed=async d=>{tokenStore.set(d.token);setUser(d.user);await loadCart()};
 const value={user,ready,cart,toast,notify,logout,loadCart,
  login:async b=>authed(await api.login(b)),register:async b=>authed(await api.register(b)),
  add:async(bc,q)=>{const d=await api.addItem(bc,q);setCart(d.cart||d);return d},
  setQty:async(id,q)=>{await api.setQty(id,q);await loadCart()},
  remove:async id=>{await api.removeItem(id);await loadCart()},
  count:(cart?.items||[]).reduce((n,i)=>n+i.quantity,0)};
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
