export const money=(minor,cur='INR')=>new Intl.NumberFormat('en-IN',{style:'currency',currency:cur||'INR'}).format((minor||0)/100);
export const when=d=>d?new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}):'';
export const dayKey=d=>{const x=new Date(d);return x.toDateString()===new Date().toDateString()?'Today':x.toLocaleDateString('en-IN',{month:'long',year:'numeric'})};
export const clean=s=>String(s??'').replace(/[<>]/g,'');
export const shortId=id=>'SK-'+String(id||'').replace(/[^a-z0-9]/gi,'').slice(-6).toUpperCase();
