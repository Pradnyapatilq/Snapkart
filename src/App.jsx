import {Routes,Route,Navigate,useLocation} from 'react-router-dom';
import {useApp} from './context/AppContext';
import {BottomNav,Toast,Logo} from './components/ui';
import Auth from './screens/Auth';import Home from './screens/Home';import Scan from './screens/Scan';import Cart from './screens/Cart';import Checkout from './screens/Checkout';
import {Bills,BillDetail} from './screens/Bills';import {Search,Profile,Help,StoreMap} from './screens/Misc';
const Guard=({children})=>{const {user}=useApp();return user?children:<Navigate to="/login" replace/>};
export default function App(){
 const {ready,user}=useApp(),loc=useLocation();
 if(!ready)return <div className="shell"><div className="splash"><div><Logo size={72} text={false}/><h1 className="disp">SnapKart</h1><p className="mut">Scan. Shop. Done.</p></div></div></div>;
 const tabs=['/','/cart','/bills','/profile'].includes(loc.pathname);
 return <div className="shell"><Toast/><Routes>
  <Route path="/login" element={user?<Navigate to="/" replace/>:<Auth mode="login"/>}/><Route path="/register" element={user?<Navigate to="/" replace/>:<Auth mode="register"/>}/>
  <Route path="/" element={<Guard><Home/></Guard>}/><Route path="/scan" element={<Guard><Scan/></Guard>}/><Route path="/cart" element={<Guard><Cart/></Guard>}/><Route path="/checkout" element={<Guard><Checkout/></Guard>}/>
  <Route path="/bills" element={<Guard><Bills/></Guard>}/><Route path="/bills/:id" element={<Guard><BillDetail/></Guard>}/><Route path="/search" element={<Guard><Search/></Guard>}/>
  <Route path="/profile" element={<Guard><Profile/></Guard>}/><Route path="/help" element={<Guard><Help/></Guard>}/><Route path="/map" element={<Guard><StoreMap/></Guard>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>
  {user&&tabs&&<BottomNav/>}</div>;
}
