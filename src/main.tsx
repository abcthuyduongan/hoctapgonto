import React,{lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import AsyncBoundary from './components/AsyncBoundary';
import {prepareOnlineBrowser} from './core/online-bootstrap';
import './styles/base.css';

const root=document.getElementById('root');
if(!root)throw new Error('Không tìm thấy phần tử root');
const OnlineScreen=lazy(()=>import('./screens/OnlineScreen'));
const address=new URL(window.location.href);
if(address.searchParams.get('online')==='0'||address.searchParams.has('legacy')||address.pathname==='/legacy-archive'){address.pathname='/';address.searchParams.set('online','1');address.searchParams.delete('legacy');history.replaceState(null,'',address);}
async function start(){
  try{if(!await prepareOnlineBrowser())return;}catch{root!.textContent='Chưa làm mới được tài nguyên ứng dụng. Hãy đóng các tab Bảo An khác rồi tải lại trang.';return;}
  createRoot(root!).render(<React.StrictMode><AsyncBoundary label="ứng dụng"><Suspense fallback={<p className="loading-state">Đang mở lớp học…</p>}><OnlineScreen/></Suspense></AsyncBoundary></React.StrictMode>);
}
void start();
