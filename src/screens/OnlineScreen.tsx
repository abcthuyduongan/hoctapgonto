import {lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import type {OnlineIdentity} from '../core/online-contracts';
import {onlineApi,OnlineError,subscribeOnlineSessionExpired} from '../core/online-client';
import AsyncBoundary from '../components/AsyncBoundary';
import '../styles/online.css';
import '../styles/learning-interface.css';

const AdminDashboard=lazy(()=>import('./OnlineAdminDashboard'));
const OnlineStudentWorld=lazy(()=>import('./OnlineStudentWorld'));
const ParentPortalScreen=lazy(()=>import('./ParentPortalScreen'));
const messageOf=(error:unknown)=>error instanceof Error?error.message:'Chưa thực hiện được yêu cầu. Hãy thử lại.';

export default function OnlineScreen(){
  const [phase,setPhase]=useState<'loading'|'unavailable'|'setup'|'login'|'ready'>('loading'),[identity,setIdentity]=useState<OnlineIdentity|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[token,setToken]=useState(''),[name,setName]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState('');
  const operating=useRef(false),loadRequest=useRef<Promise<void>|null>(null);
  const localHost=window.location.hostname;
  const localAddress=window.location.protocol==='http:'||['localhost','127.0.0.1','[::1]'].includes(localHost);
  const load=useCallback(()=>{
    if(loadRequest.current)return loadRequest.current;
    setError('');setPhase('loading');
    // Start both independent checks together. Capture identity errors immediately,
    // including when an unconfigured server can show setup before /me finishes.
    const identityResult=onlineApi.me().then(value=>({value}),error=>({error}));
    const work=(async()=>{try{const status=await onlineApi.status();if(status.available!==true)throw new Error('Máy chủ trực tuyến chưa sẵn sàng.');if(!status.configured){setPhase('setup');return;}const result=await identityResult;if('error'in result){if(result.error instanceof OnlineError&&result.error.status===401){setPhase('login');return;}throw result.error;}setIdentity(result.value);setPhase('ready');}catch(error){setError(messageOf(error));setPhase('unavailable');}})().finally(()=>{if(loadRequest.current===work)loadRequest.current=null;});
    loadRequest.current=work;return work;
  },[]);
  useEffect(()=>{void load();return subscribeOnlineSessionExpired(()=>{setIdentity(null);setPassword('');setError('Phiên đăng nhập đã hết hạn hoặc tài khoản đã được khóa. Hãy đăng nhập lại; học sinh có thể liên hệ quản trị viên lớp.');setPhase('login');});},[load]);
  useEffect(()=>{
    if(phase==='ready'&&identity){
      if(identity.user.role==='admin') document.title='Bảo An Learning · Quản trị lớp học';
      else if(identity.user.role==='parent') document.title='Bảo An Learning · Khu phụ huynh';
    } else if(phase==='setup'){
      document.title='Bảo An Learning · Khởi tạo không gian';
    } else if(phase==='login'){
      document.title='Bảo An Learning · Đăng nhập';
    }
  },[phase,identity]);
  async function logout(){await onlineApi.logout();setIdentity(null);setUsername('');setPassword('');setPhase('login');}
  if (phase === 'loading') {
    return (
      <div className="online-app online-auth" data-theme="desk" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '32px' }} role="status" aria-live="polite">
          <div className="online-brand" style={{ justifyContent: 'center', marginBottom: '16px', fontSize: '1.4rem' }}>
            ✦ BẢO AN <span>LEARNING</span>
          </div>
          <p className="online-loading" style={{ margin: 0, fontSize: '1rem', color: 'var(--online-muted)' }}>
            Đang mở không gian học tập…
          </p>
        </div>
      </div>
    );
  }
  if(phase==='ready'&&identity)return <AsyncBoundary key={identity.user.id} label={identity.user.role==='admin'?'trang quản trị':(identity.user.role==='parent'?'khu phụ huynh':'hành trình học tập')}><Suspense fallback={<p className="online-loading" role="status">Đang mở không gian học tập…</p>}>{identity.user.role==='admin'?<AdminDashboard identity={identity} onLogout={logout} onRestored={()=>{setIdentity(null);setUsername('');setPassword('');setError('Đã khôi phục dữ liệu. Hãy đăng nhập bằng tài khoản trong bản sao.');setPhase('login');}}/>:identity.user.role==='parent'?<ParentPortalScreen identity={identity} onLogout={logout}/>:<OnlineStudentWorld key={identity.user.id} identity={identity} onLogout={logout} onPasswordChanged={()=>{setIdentity(null);setPassword('');setError('Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới; tiến độ và sao vẫn được giữ nguyên.');setPhase('login');}}/>}</Suspense></AsyncBoundary>;
  return <div className="online-app online-auth" data-theme="desk"><div className="online-auth-layout"><aside className="online-auth-welcome" aria-label="Chào mừng đến Bảo An"><img src="/art/auth/auth-welcome.webp" alt="Chào mừng đến Bảo An Learning" className="online-auth-banner-img" loading="eager" /><span className="online-auth-mascot" aria-hidden="true">🦊</span><p className="online-eyebrow">THẾ GIỚI NHỎ, KHÁM PHÁ LỚN</p><h2>Chơi một chút.<br/>Khám phá thật nhiều.</h2><p>Mỗi câu hỏi là một bước nhỏ.<br/>Cáo cùng con khám phá những điều hay.</p><ol className="online-auth-route"><li><span>1</span> Chọn địa điểm</li><li><span>2</span> Chơi & học</li><li><span>3</span> Góp thêm sao</li></ol><span className="online-auth-caption">Một hành trình, nhiều điều mới.</span></aside><main className="online-auth-card"><a className="online-brand" href="/?online=1">✦ BẢO AN <span>LEARNING</span></a><p className="online-eyebrow">HỌC TẬP THEO TÀI KHOẢN</p>{phase==='unavailable'?<><h1>Máy chủ chưa sẵn sàng</h1><p className="online-notice online-error" role="alert">{error}</p>{localAddress?<p>Trên máy lưu dữ liệu, mở thư mục ứng dụng và chạy <code>npm run online</code>. Sau đó mở địa chỉ do máy chủ hiển thị; các thiết bị khác dùng cùng địa chỉ này.</p>:<p>Quản trị viên website cần kiểm tra các biến môi trường của máy chủ trên nền tảng triển khai, gồm địa chỉ website và kết nối Supabase, rồi triển khai lại. Học sinh có thể thử kết nối lại sau khi quản trị viên hoàn tất.</p>}<button className="online-primary" onClick={()=>void load()}>Thử kết nối lại</button></>:<>
      <h1>{phase==='setup'?'Tạo không gian học tập':'Chào mừng bạn trở lại'}</h1><p>{phase==='setup'?'Cấp tài khoản quản trị đầu tiên cho máy chủ này. Sau đó bạn có thể tạo lớp và tài khoản riêng cho từng học sinh.':'Đăng nhập bằng tài khoản do quản trị viên cấp. Thành tích đi cùng tài khoản của bạn.'}</p>{error&&<p className="online-notice online-error" role="alert">{error}</p>}<form className="online-form" onSubmit={event=>{event.preventDefault();if(operating.current)return;operating.current=true;setBusy(true);setError('');void (phase==='setup'?onlineApi.setup({token:token.trim(),name:name.trim(),username:username.trim(),password}):onlineApi.login({username:username.trim(),password})).then(result=>{setIdentity(result);setPassword('');setToken('');setPhase('ready');}).catch(error=>setError(messageOf(error))).finally(()=>{operating.current=false;setBusy(false);});}}><fieldset disabled={busy}>{phase==='setup'&&<><label>Mã khởi tạo máy chủ<input type="password" required autoComplete="off" value={token} onChange={event=>setToken(event.target.value)}/></label><p className="online-muted">Dùng mã bootstrap được cấu hình khi chạy máy chủ. Không gian chưa có tài khoản hoặc học liệu mẫu.</p><label>Tên không gian học tập<input required maxLength={100} autoComplete="organization" value={name} onChange={event=>setName(event.target.value)}/></label></>}<label>Tên đăng nhập<input required maxLength={60} autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event=>setUsername(event.target.value)}/></label><label>Mật khẩu<input type="password" required minLength={phase==='setup'?10:undefined} maxLength={128} autoComplete={phase==='setup'?'new-password':'current-password'} value={password} onChange={event=>setPassword(event.target.value)}/></label><button className="online-primary">{busy?'Đang xử lý…':phase==='setup'?'Tạo tài khoản quản trị':'Đăng nhập'}</button></fieldset></form><p className="online-muted">Học sinh quên mật khẩu liên hệ quản trị viên lớp để được cấp lại.</p></>}
    </main></div></div>;
}
