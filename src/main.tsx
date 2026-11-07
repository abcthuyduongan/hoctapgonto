import React,{lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import AsyncBoundary from './components/AsyncBoundary';
import {prepareOnlineBrowser} from './core/online-bootstrap';
import './styles/base.css';

const root=document.getElementById('root');
if(!root)throw new Error('Không tìm thấy phần tử root');
root.dataset.appVersion=__BAO_AN_BUILD_INFO__.version;
root.dataset.sourceId=__BAO_AN_BUILD_INFO__.sourceId;
const OnlineScreen=lazy(()=>import('./screens/OnlineScreen'));
const UiShowcase=lazy(()=>import('./ui/UiShowcase'));
const address=new URL(window.location.href);
const isUiShowcase=address.searchParams.get('ui')==='1';
if(!isUiShowcase&&(address.searchParams.get('online')==='0'||address.searchParams.has('legacy')||address.pathname==='/legacy-archive')){address.pathname='/';address.searchParams.set('online','1');address.searchParams.delete('legacy');history.replaceState(null,'',address);}
async function start(){
  if(isUiShowcase){
    createRoot(root!).render(<React.StrictMode><Suspense fallback={<p className="loading-state">Đang mở trang mẫu UI…</p>}><UiShowcase/></Suspense></React.StrictMode>);
    return;
  }
  try{if(!await prepareOnlineBrowser())return;}catch{root!.textContent='Chưa làm mới được tài nguyên ứng dụng. Hãy đóng các tab Bảo An khác rồi tải lại trang.';return;}
  createRoot(root!).render(<React.StrictMode><AsyncBoundary label="ứng dụng"><Suspense fallback={<p className="loading-state">Đang mở lớp học…</p>}><OnlineScreen/></Suspense></AsyncBoundary></React.StrictMode>);
}
void start();
