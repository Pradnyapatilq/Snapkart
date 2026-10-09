// Centralized API client: base URL, auth header, JSON, timeouts, error mapping, 401 handling.
const BASE=import.meta.env.VITE_API_BASE_URL||'http://localhost:3000';
export const tokenStore={get:()=>localStorage.getItem('sk_token'),set:t=>t?localStorage.setItem('sk_token',t):localStorage.removeItem('sk_token')};
export class ApiError extends Error{constructor(status,code,message,data){super(message);this.status=status;this.code=code;this.data=data}}
function friendly(status,d,auth){
 const x=d?.error&&typeof d.error==='object'?d.error:d||{};const c=String(x.code||(typeof d?.error==='string'?d.error:'')).toUpperCase();
 if(status===404&&(c==='PRODUCT_NOT_FOUND'||!c))return {code:'PRODUCT_NOT_FOUND',msg:"This barcode isn't available in the SnapKart catalog. Try scanning again."};
 if(status===401)return {code:'UNAUTHORIZED',msg:auth?'Your session has expired. Please sign in again.':'Incorrect email or password.'};
 if(status===409&&c.includes('STOCK')){const n=x.available??x.stock??x.details?.available;return {code:'INSUFFICIENT_STOCK',msg:(n!=null?`Only ${n} units are currently available.`:'Not enough stock is available.')+' Your cart has been updated.'}}
 if(status===409)return {code:c||'CONFLICT',msg:'An account with this email already exists.'};
 if(c==='EMPTY_CART')return {code:c,msg:'Your cart is empty. Scan a product to get started.'};
 if(status===402)return {code:'PAYMENT_DECLINED',msg:'Payment could not be completed.'};
 if(c.includes('IDEMPOTENCY')||status>=500)return {code:'SERVER',msg:'Something went wrong on our side. Please try again.'};
 const m=typeof x.message==='string'?x.message:'';return {code:c||'ERROR',msg:m&&m.length<120?m:'Something went wrong. Please try again.'};
}
async function req(path,{method='GET',body,headers={},auth=true}={}){
 const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),15000),tk=tokenStore.get();
 const h={...headers};if(body)h['Content-Type']='application/json';if(auth&&tk)h.Authorization=`Bearer ${tk}`;
 let r;try{r=await fetch(BASE+path,{method,headers:h,body:body?JSON.stringify(body):undefined,signal:ctl.signal})}
 catch(e){throw new ApiError(0,'NETWORK',e.name==='AbortError'?'The request timed out. Please try again.':"Can't reach SnapKart. Check your connection and try again.")}
 finally{clearTimeout(t)}
 let d=null;try{d=await r.json()}catch{}
 if(r.status===401&&auth&&tk){tokenStore.set(null);window.dispatchEvent(new Event('sk:unauthorized'))}
 if(!r.ok){const f=friendly(r.status,d,auth&&!!tk);throw new ApiError(r.status,f.code,f.msg,d)}
 return {status:r.status,data:d};
}
const J=async(p,o)=>(await req(p,o)).data;
export const api={
 health:()=>J('/health',{auth:false}),
 register:b=>J('/auth/register',{method:'POST',body:b,auth:false}),
 login:b=>J('/auth/login',{method:'POST',body:b,auth:false}),
 me:()=>J('/auth/me'),
 products:(q='',page=1,limit=20)=>J(`/products?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
 byBarcode:c=>J(`/products/barcode/${encodeURIComponent(c)}`),
 cart:()=>J('/cart'),
 addItem:(barcode,quantity)=>J('/cart/items',{method:'POST',body:{barcode,quantity}}),
 setQty:(id,quantity)=>J(`/cart/items/${encodeURIComponent(id)}`,{method:'PATCH',body:{quantity}}),
 removeItem:id=>J(`/cart/items/${encodeURIComponent(id)}`,{method:'DELETE'}),
 checkout:key=>req('/checkout',{method:'POST',headers:{'Idempotency-Key':key},body:{}}),
 orders:()=>J('/orders'),
 order:id=>J(`/orders/${encodeURIComponent(id)}`),
};
