import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {AttemptInput,GameHostProps,ModuleId} from '../core/contracts';
import type {OnlineIdentity,OnlineCompactPlay,OnlineStudentSummary,OnlinePackSummary,OnlineSummarySet,OnlineAttemptReceipt} from '../core/online-contracts';
import OnlineQuestionStars from './OnlineQuestionStars';
import {onlineMoney,onlineTime,onlineRewardStatus} from '../core/online-format';
import '../styles/student-shell.css';
import {onlineApi} from '../core/online-client';
import {newId} from '../core/utils';
import {stopSpeaking} from '../core/speech';
import {stopQuestionAudio} from '../core/question-audio';
import {rewardStatus} from '../core/reward-wallet';
import StudentScreen from './StudentScreen';
import AsyncBoundary from '../components/AsyncBoundary';
import {QuestionMediaScope,preloadQuestionImage} from '../components/QuestionMedia';
import {GAME_COMPONENTS,preloadGameComponent} from '../games/loaders';
import type {MapOverviewResponse,MapRegionId,RegionMapView} from '../core/world-map-contracts';
import {resolveRegionId} from '../core/world-map-regions';
import {getSlotFromPosition} from '../core/world-map-adapter';
import WorldMap from '../components/WorldMap';
import RegionMap, {getLandmark} from '../components/RegionMap';
import MapWeekPanel from '../components/MapWeekPanel';
import GoalBar from '../components/GoalBar';
import {DiscoveryCardDialog, DiscoveryNotebookDialog, type DiscoveryNotebookItem} from '../components/DiscoveryDialog';
import StudentHeader from '../components/StudentHeader';
import StudentBottomNav from '../components/StudentBottomNav';
import {EmptyState} from '../ui/EmptyState';
import {parseStudentDeepLink, type DeepLinkRoute} from '../core/student-deep-link';
import '../styles/student-frame.css';
import '../styles/world-map.css';

const GiftShelfDialog=lazy(()=>import('../components/GiftShelfDialog'));
const StreakDialog=lazy(()=>import('../components/StreakDialog').then(m=>({default:m.StreakDialog})));
const DailyMissionDialog=lazy(()=>import('../components/DailyMissionDialog').then(m=>({default:m.DailyMissionDialog})));
const BadgeShowcaseDialog=lazy(()=>import('../components/BadgeShowcaseDialog').then(m=>({default:m.BadgeShowcaseDialog})));

const ParentPinModal=lazy(()=>import('../components/ParentPinModal'));
const ParentPortalScreen=lazy(()=>import('./ParentPortalScreen'));
const ContestMockScreen=lazy(()=>import('./ContestMockScreen').then(m=>({default:m.ContestMockScreen})));
const TownScreen=lazy(()=>import('./TownScreen').then(m=>({default:m.TownScreen})));

const importExercise=()=>import('./OnlineExerciseRunner');
let exerciseModule:ReturnType<typeof importExercise>|undefined;
function preloadExercise(){return exerciseModule??=(importExercise().catch(error=>{exerciseModule=undefined;throw error;}));}
const OnlineExerciseRunner=lazy(preloadExercise);
const OnlinePasswordDialog=lazy(()=>import('./OnlinePasswordDialog'));
const OnlineWeekAdvanceDialog=lazy(()=>import('./OnlineWeekAdvanceDialog'));
const messageOf=(error:unknown)=>error instanceof Error?error.message:'Chưa lưu được yêu cầu. Hãy thử lại.';
function applyQuestionReceipt(state:OnlineStudentSummary,packId:string,receipt:NonNullable<OnlineAttemptReceipt['questionRewards']>):OnlineStudentSummary{
  const updates=new Map(receipt.questions.map(q=>[q.itemId,q.tier])),before=state.current?.pack.id===packId?state.current:state.weeks.flatMap(w=>w.sets).find(s=>s.pack.id===packId);
  function update(set:OnlineSummarySet):OnlineSummarySet{if(set.pack.id!==packId)return set;const old=set.questionProgress,questions=old.questions.map(q=>({...q,tier:Math.max(q.tier,updates.get(q.itemId)??0) as typeof q.tier})),counts=[0,0,0,0];questions.forEach(q=>counts[q.tier]++);const bestTier=Math.min(...questions.map(q=>q.tier)) as typeof questions[number]['tier'],done: boolean=questions.length>0&&bestTier>=2;return{...set,stars:bestTier,done,questionProgress:{...old,questions,zero:counts[0],one:counts[1],two:counts[2],three:counts[3],bestTier,done,earnedStars:old.earnedStars+receipt.gained}};}
  const current=state.current?{...state.current,...update(state.current)}:null,weeks=state.weeks.map(week=>({...week,sets:week.sets.map(update)})),after=before?update(before):undefined,summary=state.currentWeekSummary;
  const currentWeekSummary=summary&&before&&after?{...summary,zero:summary.zero+after.questionProgress.zero-before.questionProgress.zero,one:summary.one+after.questionProgress.one-before.questionProgress.one,two:summary.two+after.questionProgress.two-before.questionProgress.two,three:summary.three+after.questionProgress.three-before.questionProgress.three}:summary?{...summary}:null;
  if(currentWeekSummary)currentWeekSummary.ready=currentWeekSummary.zero===0&&currentWeekSummary.one===0;
  return{...state,current,weeks,currentWeekSummary,balance:receipt.balance??{...state.balance,earned:state.balance.earned+receipt.gained,available:state.balance.available+receipt.gained}};
}

function OnlineWallet({state,onRefresh,onClose}:{state:OnlineStudentSummary;onRefresh:()=>Promise<void>;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),requestId=useRef(newId()),operating=useRef(false);
  const [title,setTitle]=useState(''),[goal,setGoal]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};},[]);
  async function run(action:()=>Promise<void>){if(operating.current)return;operating.current=true;setBusy(true);setError('');setNotice('');try{await action();await onRefresh();}catch(error){setError(messageOf(error));}finally{operating.current=false;setBusy(false);}}
  const stars=Number.isSafeInteger(Number(goal))&&Number(goal)>0?Math.ceil(Number(goal)/state.wallet.rateVnd):0;
  return <dialog className="online-dialog online-wallet" ref={dialog} aria-labelledby="online-wallet-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <div className="online-section-head"><h2 id="online-wallet-title">⭐ Ví đổi sao của con</h2><button type="button" onClick={onClose} disabled={busy}>Đóng ✕</button></div>
    <div className="online-balance"><strong>{state.balance.available} sao khả dụng</strong><span>{state.balance.pending} sao đang chờ · {state.balance.redeemed} sao đã đổi</span></div>
    <p>Con đã tích lũy {state.balance.earned} sao. Mỗi câu nhận tối đa 3 sao dùng chung mọi trò; học lại chỉ cộng phần tăng thêm.</p>
    <p className="online-muted">Người lớn trực tiếp trao tiền hoặc quà sau khi duyệt. Ứng dụng lưu lịch sử đổi sao.</p>
    {error&&<p className="online-notice online-error" role="alert">{error}</p>}{notice&&<p className="online-notice" role="status">{notice}</p>}
    {state.wallet.enabled?<form className="online-form" onSubmit={event=>{event.preventDefault();void run(async()=>{await onlineApi.requestRedemption({requestId:requestId.current,title:title.trim(),goalVnd:Number(goal)});requestId.current=newId();setTitle('');setGoal('');setNotice('Đã gửi ước muốn của con. Sao được giữ trong lúc chờ duyệt.');});}}>
      <p>1 sao = <strong>{onlineMoney(state.wallet.rateVnd)}</strong></p>
      <label>Món quà con mong muốn<input required maxLength={120} value={title} onChange={event=>{setTitle(event.target.value);requestId.current=newId();}} disabled={busy}/></label>
      <label>Mục tiêu tiền (đồng)<input type="number" required min="1" step="1" max="100000000" value={goal} onChange={event=>{setGoal(event.target.value);requestId.current=newId();}} disabled={busy}/></label>
      <p aria-live="polite">{stars?`Cần ${stars} sao = ${onlineMoney(stars*state.wallet.rateVnd)}${stars>state.balance.available?`. Con cần thêm ${stars-state.balance.available} sao.`:'. Con đã đủ sao cho mục tiêu này.'}`:'Nhập mục tiêu để xem cần bao nhiêu sao.'}</p>
      <button className="online-primary" disabled={busy||!title.trim()||stars<1||stars>state.balance.available}>{busy?'Đang gửi…':'Gửi ước muốn'}</button>
    </form>:<p>Quản trị viên chưa bật đổi sao. Con vẫn giữ đầy đủ thành tích.</p>}
    <h3>Lịch sử đổi sao</h3><ul className="online-list">{[...state.requests].reverse().map(request=><li key={request.requestId}><strong>{request.title}</strong><span>{request.stars} sao · {onlineMoney(request.amountVnd)}</span><span>{onlineRewardStatus[rewardStatus(request)]}</span><small>{onlineTime(request.requestedAt)}</small>{request.history.slice(1).map((row,index)=><small key={index}>{onlineRewardStatus[row.status]} · {onlineTime(row.at)}{row.note?` · ${row.note}`:''}</small>)}{rewardStatus(request)==='pending'&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{await onlineApi.cancelRedemption(request.requestId);setNotice('Đã hủy yêu cầu và trả lại sao khả dụng.');})}>Hủy yêu cầu</button>}</li>)}</ul>{!state.requests.length&&<p>Con chưa gửi ước muốn nào.</p>}
  </dialog>;
}

export default function OnlineStudentWorld({identity,onLogout,onPasswordChanged}:{identity:OnlineIdentity;onLogout:()=>Promise<void>;onPasswordChanged:()=>void}){
  const [state,setState]=useState<OnlineStudentSummary|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[starting,setStarting]=useState(false),[active,setActive]=useState<OnlineCompactPlay|null>(null),[walletOpen,setWalletOpen]=useState(false),[giftShelfOpen,setGiftShelfOpen]=useState(false),[passwordOpen,setPasswordOpen]=useState(false),[loadingMore,setLoadingMore]=useState(false),[motionOn,setMotionOn]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches),[soundOn,setSoundOn]=useState(false),[reward,setReward]=useState<{gained:number;tier:number}|null>(null);
  const [streakOpen,setStreakOpen]=useState(false),[missionsOpen,setMissionsOpen]=useState(false),[badgesOpen,setBadgesOpen]=useState(false);
  const [parentPinOpen,setParentPinOpen]=useState(false),[parentPortalOpen,setParentPortalOpen]=useState(false),[parentDashboardData,setParentDashboardData]=useState<any>(null);
  const [contestOpen,setContestOpen]=useState(false),[contestPresetId,setContestPresetId]=useState<string|undefined>(undefined);
  const [townOpen,setTownOpen]=useState(false);
  const [advanceOpen,setAdvanceOpen]=useState(false),[reviewEpoch,setReviewEpoch]=useState(0),[questionNotice,setQuestionNotice]=useState('');
  const [refreshing,setRefreshing]=useState(false),[selectingPack,setSelectingPack]=useState<string|null>(null),[gameAction,setGameAction]=useState<'answer'|'complete'|'exit'|null>(null);
  const [mapMode,setMapMode]=useState<'map'|'list'>(()=>{
    if(typeof window==='undefined')return 'map';
    const params=new URLSearchParams(window.location.search);
    const mode=params.get('mode')||params.get('view');
    if (mode === 'list') return 'list';
    return 'map';
  }),[mapView,setMapView]=useState<'world'|'region'>('world'),[selectedRegion,setSelectedRegion]=useState<MapRegionId|null>(null),[selectedChapter,setSelectedChapter]=useState(1),[selectedWeekId,setSelectedWeekId]=useState<string|null>(null),[mapData,setMapData]=useState<MapOverviewResponse|null>(null);
  const [journeyExpanded,setJourneyExpanded]=useState(false);
  const [isMobile,setIsMobile]=useState(()=>{
    if(typeof window==='undefined')return false;
    return window.matchMedia('(max-width: 1024px)').matches;
  });
  useEffect(()=>{
    if(typeof window==='undefined')return;
    const mql=window.matchMedia('(max-width: 1024px)');
    const handler=(e:MediaQueryListEvent)=>setIsMobile(e.matches);
    mql.addEventListener('change',handler);
    return()=>mql.removeEventListener('change',handler);
  },[]);
  useEffect(()=>{
    if(active) document.title=`Bảo An Learning · ${active.pack.title}`;
    else if(parentPortalOpen) document.title='Bảo An Learning · Khu phụ huynh';
    else if(contestOpen) document.title='Bảo An Learning · Thi thử Trạng Nguyên & Violympic';
    else if(townOpen) document.title='Bảo An Learning · Thị trấn của con';
    else if(mapMode==='list') document.title='Bảo An Learning · Hành trình theo tuần';
    else if(mapView==='region'&&selectedRegion) document.title='Bảo An Learning · Bản đồ vùng môn';
    else document.title='Bảo An Learning · Bản đồ thế giới';
  },[active,parentPortalOpen,contestOpen,townOpen,mapMode,mapView,selectedRegion]);

  const handleDeepLink = useCallback((route: DeepLinkRoute) => {
    switch (route.target) {
      case 'hoc': {
        setMapMode('map');
        setContestOpen(false);
        setTownOpen(false);
        setGiftShelfOpen(false);
        setMissionsOpen(false);
        setBadgesOpen(false);
        setStreakOpen(false);
        const region = route.regionId || (route.subject ? resolveRegionId(route.subject) : null);
        if (region && region !== 'discovery') {
          setSelectedRegion(region);
          setMapView('region');
        } else {
          setMapView('world');
        }
        break;
      }
      case 'nhiem-vu': {
        setContestOpen(false);
        setTownOpen(false);
        setGiftShelfOpen(false);
        setBadgesOpen(false);
        setStreakOpen(false);
        setMissionsOpen(true);
        break;
      }
      case 'thi': {
        setTownOpen(false);
        setGiftShelfOpen(false);
        setMissionsOpen(false);
        setBadgesOpen(false);
        setStreakOpen(false);
        setContestPresetId(route.presetId);
        setContestOpen(true);
        break;
      }
      case 'qua': {
        setContestOpen(false);
        setTownOpen(false);
        setMissionsOpen(false);
        setBadgesOpen(false);
        setStreakOpen(false);
        setGiftShelfOpen(true);
        break;
      }
      case 'ban-do':
      default: {
        setMapMode('map');
        setContestOpen(false);
        setTownOpen(false);
        setGiftShelfOpen(false);
        setMissionsOpen(false);
        setBadgesOpen(false);
        setStreakOpen(false);
        setMapView('world');
        setSelectedRegion(null);
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      const hash = window.location.hash;
      if (hash && hash !== '#' && hash !== '#/') {
        const route = parseStudentDeepLink(hash);
        handleDeepLink(route);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [handleDeepLink]);
  const [activeDiscovery,setActiveDiscovery]=useState<{pack:OnlinePackSummary;subjectLabel:string}|null>(null),[notebookOpen,setNotebookOpen]=useState(false);
  const mapGeneration=useRef(0),mapAbort=useRef<AbortController|null>(null);
  const selectedRegionRef=useRef(selectedRegion);selectedRegionRef.current=selectedRegion;
  const selectedChapterRef=useRef(selectedChapter);selectedChapterRef.current=selectedChapter;
  const savingAttempt=useRef(false);
  const studentMain=useRef<HTMLElement|null>(null);
  const journeyInitialized=useRef(false),advanceRequest=useRef<{weekId:string;requestId:string}|null>(null),activeSession=useRef<string|null>(null);
  const gameDialog=useRef<HTMLDivElement>(null),previousFocus=useRef<HTMLElement|null>(null),startingGuard=useRef(false),closing=useRef(false),complete=useRef(false),completionPromise=useRef<Promise<void>|null>(null),startRequest=useRef<{key:string;id:string}|null>(null),generation=useRef(0),refreshInFlight=useRef<Promise<void>|null>(null);
  const requests=useRef(new Set<AbortController>()),mounted=useRef(true),moreGuard=useRef(false),backgroundBlocked=useRef(false);
  backgroundBlocked.current=!!active||starting||loadingMore||walletOpen||giftShelfOpen||passwordOpen||advanceOpen||contestOpen;
  function cancelJourneyReads(){
    ++generation.current;
    requests.current.forEach(controller=>controller.abort());requests.current.clear();
    refreshInFlight.current=null;setRefreshing(false);
  }
  function openPassword(){if(startingGuard.current||active)return;cancelJourneyReads();setPasswordOpen(true);}
  const refresh=useCallback(()=>{
    if(refreshInFlight.current)return refreshInFlight.current;
    setRefreshing(true);
    const nextGeneration=++generation.current,controller=new AbortController();requests.current.add(controller);
    const work=(journeyInitialized.current?onlineApi.studentSummary('current',controller.signal):onlineApi.studentJourney('current',controller.signal)).then(next=>{
      if(nextGeneration===generation.current&&mounted.current){journeyInitialized.current=true;setState(next);setError('');void fetchMapData(selectedRegionRef.current,selectedChapterRef.current);}
    }).finally(()=>{
      requests.current.delete(controller);
      if(refreshInFlight.current===work){refreshInFlight.current=null;if(mounted.current)setRefreshing(false);}
    });
    refreshInFlight.current=work;return work;
  },[]);
  const fetchMapData=useCallback((region?:MapRegionId|null,chapter?:number|'current')=>{
    if(mapAbort.current)mapAbort.current.abort();
    const nextGen=++mapGeneration.current,controller=new AbortController();mapAbort.current=controller;
    return onlineApi.studentMap({region:region??undefined,chapter:region?chapter:undefined},controller.signal).then(res=>{
      if(nextGen===mapGeneration.current&&mounted.current){
        setMapData(res);
        if(res.regionView)setSelectedChapter(res.regionView.chapter);
      }
    }).catch(err=>{
      if(err?.name!=='AbortError'&&mounted.current){/* non-blocking */}
    }).finally(()=>{if(mapAbort.current===controller)mapAbort.current=null;});
  },[]);
  const handleSelectRegion=useCallback((regionId:MapRegionId)=>{
    setSelectedRegion(regionId);setMapView('region');
    const curRegion=resolveRegionId(state?.current?.subjectLabel);
    const useCur=curRegion===regionId&&state?.currentWeekSummary?'current':1;
    void fetchMapData(regionId,useCur);
    if(curRegion===regionId&&state?.currentWeekSummary)setSelectedWeekId(state.currentWeekSummary.weekId);
    else setSelectedWeekId(null);
  },[state,fetchMapData]);
  const handleContinueCurrent=useCallback(()=>{
    const curRegion=resolveRegionId(state?.current?.subjectLabel);
    setSelectedRegion(curRegion);setMapView('region');
    void fetchMapData(curRegion,'current');
    if(state?.currentWeekSummary)setSelectedWeekId(state.currentWeekSummary.weekId);
  },[state,fetchMapData]);
  const handleBackToWorld=useCallback(()=>{
    setMapView('world');setSelectedRegion(null);setSelectedWeekId(null);
    void fetchMapData();
  },[fetchMapData]);
  const handleChangeChapter=useCallback((chapter:number)=>{
    if(!selectedRegion)return;
    setSelectedChapter(chapter);setSelectedWeekId(null);
    void fetchMapData(selectedRegion,chapter);
  },[selectedRegion,fetchMapData]);
  const handleSelectWeek=useCallback((weekId:string)=>{
    setSelectedWeekId(weekId);
    if(!state)return;
    const targetWeek=state.weeks.find(w=>w.id===weekId);
    if(targetWeek){
      const unviewedSet=targetWeek.sets.find(s=>s.pack.discovery&&!state.viewedDiscoveryPacks?.includes(s.pack.id));
      if(unviewedSet){
        setActiveDiscovery({pack:unviewedSet.pack,subjectLabel:unviewedSet.subjectLabel});
      }
    }
  },[state]);
  const handleCloseDiscovery=useCallback(()=>{
    if(activeDiscovery){
      const packId=activeDiscovery.pack.id;
      setActiveDiscovery(null);
      void onlineApi.viewDiscovery(packId).catch(()=>{});
      setState(prev=>prev?{...prev,viewedDiscoveryPacks:[...(prev.viewedDiscoveryPacks||[]),packId]}:prev);
    }
  },[activeDiscovery]);
  const unlockedDiscoveryCards:DiscoveryNotebookItem[]=useMemo(()=>{
    if(!state)return[];
    const cards:DiscoveryNotebookItem[]=[];
    for(const week of state.weeks){
      for(const set of week.sets){
        if(set.pack.discovery){
          cards.push({packId:set.pack.id,subjectLabel:set.subjectLabel,packTitle:set.pack.title,discovery:set.pack.discovery});
        }
      }
    }
    return cards;
  },[state]);
  useEffect(()=>{let alive=true;mounted.current=true;void refresh().catch(error=>{if(alive&&error?.name!=='AbortError')setError(messageOf(error));}).finally(()=>{if(alive)setLoading(false);});void fetchMapData().catch(()=>{});const update=()=>{if(!backgroundBlocked.current&&document.visibilityState==='visible')void refresh().catch(error=>{if(alive&&error?.name!=='AbortError')setError(messageOf(error));});};window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{alive=false;mounted.current=false;++generation.current;requests.current.forEach(controller=>controller.abort());requests.current.clear();if(mapAbort.current)mapAbort.current.abort();refreshInFlight.current=null;window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};},[refresh,fetchMapData,identity.user.id,identity.user.workspaceId]);
  async function loadPage(cursor:string){if(!state||moreGuard.current)return;cancelJourneyReads();moreGuard.current=true;setLoadingMore(true);const nextGeneration=generation.current,controller=new AbortController();requests.current.add(controller);try{const next=await onlineApi.studentSummary(cursor,controller.signal);if(nextGeneration!==generation.current||!mounted.current)return;setState(next);setError('');}catch(error){if(mounted.current&&error instanceof Error&&error.name!=='AbortError')setError(messageOf(error));}finally{requests.current.delete(controller);moreGuard.current=false;if(mounted.current)setLoadingMore(false);}}
  async function advanceWeek(){const week=state?.currentWeekSummary;if(!week?.ready||!week.hasNext)return;if(advanceRequest.current?.weekId!==week.weekId)advanceRequest.current={weekId:week.weekId,requestId:newId()};const next=await onlineApi.advanceWeek(advanceRequest.current);if(mounted.current){++generation.current;setState(next);setAdvanceOpen(false);setReviewEpoch(0);setError('');advanceRequest.current=null;void fetchMapData(selectedRegion,selectedChapter);}}
  async function chooseReplay(pack:OnlinePackSummary){if(startingGuard.current)return;cancelJourneyReads();startingGuard.current=true;setSelectingPack(pack.id);setStarting(true);const nextGeneration=generation.current,controller=new AbortController();requests.current.add(controller);try{const result=await onlineApi.packGames(pack.id,pack.version,controller.signal);if(mounted.current&&nextGeneration===generation.current)setState(previous=>previous?{...previous,weeks:previous.weeks.map(week=>({...week,sets:week.sets.map(set=>set.pack.id===pack.id&&set.pack.version===pack.version?{...set,games:result.games}:set)}))}:previous);}catch(error){if(mounted.current&&error instanceof Error&&error.name!=='AbortError')setError(messageOf(error));}finally{requests.current.delete(controller);startingGuard.current=false;if(mounted.current){setStarting(false);setSelectingPack(null);}}}
  useEffect(()=>{document.documentElement.dataset.sound=soundOn?'on':'off';document.documentElement.dataset.motion=motionOn?'on':'off';return()=>{delete document.documentElement.dataset.sound;delete document.documentElement.dataset.motion;};},[soundOn,motionOn]);
  useEffect(()=>{
    return ()=>{
      document.body.style.overflow='';
      document.documentElement.style.scrollbarGutter='';
    };
  },[]);
  useEffect(()=>{
    if(!active)return;
    const previousOverflow=document.body.style.overflow,previousGutter=document.documentElement.style.scrollbarGutter;
    document.body.style.overflow='hidden';document.documentElement.style.scrollbarGutter='auto';
    const dialog=gameDialog.current;dialog?.focus({preventScroll:true});
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab'||!dialog)return;
      if(closing.current){event.preventDefault();dialog.focus({preventScroll:true});return;}
      const scope=dialog.querySelector<HTMLElement>('.reward-panel')??dialog;
      const controls=[...scope.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(element=>element.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1);
      if(!first||!last){event.preventDefault();scope.focus();return;}
      if(!scope.contains(document.activeElement)||event.shiftKey&&document.activeElement===first||!event.shiftKey&&document.activeElement===last){event.preventDefault();(event.shiftKey?last:first).focus();}
    };
    document.addEventListener('keydown',trap);
    return()=>{
      document.body.style.overflow=previousOverflow;document.documentElement.style.scrollbarGutter=previousGutter;
      document.removeEventListener('keydown',trap);
      requestAnimationFrame(()=>{if(activeSession.current)return;const target=previousFocus.current?.isConnected?previousFocus.current:studentMain.current;target?.focus({preventScroll:true});});
    };
  },[active?.session.sessionId]);
  async function startGame(moduleId:ModuleId,pack:OnlinePackSummary,reviewItemIds?:string[]){
    if(startingGuard.current||active||passwordOpen||advanceOpen)return;
    previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    cancelJourneyReads();startingGuard.current=true;setStarting(true);setError('');
    void (pack.kind==='learning'?preloadExercise():preloadGameComponent(moduleId)).catch(()=>{/* The game boundary retains its retry/exit UI if loading still fails. */});
    const key=`${moduleId}:${pack.id}@${pack.version}:${reviewItemIds?.join(',')??'all'}`;
    if(startRequest.current?.key!==key)startRequest.current={key,id:newId()};
    const controller=new AbortController();requests.current.add(controller);
    try{
      const play=await onlineApi.playCompact({moduleId,packId:pack.id,contentVersion:pack.version,requestId:startRequest.current.id,...(reviewItemIds?{reviewItemIds}:{})},controller.signal);
      if(!mounted.current)return;
      if(play.presentation.kind==='quiz'||play.presentation.kind==='learning')preloadQuestionImage(play.session.sessionId,play.presentation.items[0]?.media);
      // Card boards show every image at once: fetch them together while the game chunk mounts, instead of card by card.
      else play.presentation.items.filter(item=>item.media?.imageId).slice(0,12).forEach(item=>preloadQuestionImage(play.session.sessionId,item.media));
      complete.current=false;completionPromise.current=null;setReward(null);setQuestionNotice('');setGameAction(null);
      activeSession.current=play.session.sessionId;setActive(play);startRequest.current=null;
    }catch(error){if(mounted.current&&error instanceof Error&&error.name!=='AbortError')setError(messageOf(error));}
    finally{requests.current.delete(controller);startingGuard.current=false;if(mounted.current)setStarting(false);}
  }
  async function recordAttempt(input:AttemptInput){
    if(!active||complete.current||closing.current)throw new Error('Phiên chơi đã kết thúc hoặc đang đóng.');
    savingAttempt.current=true;setGameAction('answer');
    try{
      const receipt=await onlineApi.attempt(active.session.sessionId,input);
      if(!mounted.current||activeSession.current!==active.session.sessionId)return;
      if(receipt.questionRewards){const committed=receipt.questionRewards;setState(previous=>previous?applyQuestionReceipt(previous,active.pack.id,committed):previous);setQuestionNotice(receipt.event.correct?`${committed.questions.map(q=>`${q.tier}/3 sao`).join(', ')} · ${committed.gained?`+${committed.gained} sao mới`:'Giữ mức cao nhất đã đạt'}. Máy chủ đã lưu.`:'Câu này chưa đúng. Con thử lại để hoàn thành.');}
      return{correct:receipt.event.correct,feedback:receipt.feedback};
    }finally{savingAttempt.current=false;if(mounted.current&&activeSession.current===active.session.sessionId)setGameAction(null);}
  }
  function completeGame():Promise<void>{
    if(!active||complete.current)return Promise.resolve();if(completionPromise.current)return completionPromise.current;
    setGameAction('complete');
    const work=(async()=>{
      try{const result=await onlineApi.completeCompact(active.session.sessionId);complete.current=true;if(mounted.current){++generation.current;setState(result.state);setReward(active.session.rewardPolicyVersion===2?null:{gained:result.gained,tier:result.tier});setError('');void fetchMapData(selectedRegion,selectedChapter);}}
      catch(error){if(mounted.current)setError(messageOf(error));throw error;}
      finally{completionPromise.current=null;if(mounted.current&&activeSession.current===active.session.sessionId)setGameAction(null);}
    })();completionPromise.current=work;return work;
  }
  async function leaveGame(){
    if(!active||closing.current||savingAttempt.current||completionPromise.current)return;
    closing.current=true;setGameAction('exit');gameDialog.current?.focus({preventScroll:true});stopSpeaking();stopQuestionAudio();
    try{
      const needsRefresh=!complete.current;
      if(needsRefresh)await onlineApi.abandon(active.session.sessionId);
      if(!mounted.current)return;
      activeSession.current=null;setActive(null);setError('');
      // Completing already returned fresh progress. Only interrupted games need a read.
      if(needsRefresh){void refresh().catch(error=>{if(mounted.current&&error?.name!=='AbortError')setError(messageOf(error));});void fetchMapData(selectedRegion,selectedChapter);}
    }catch(error){if(mounted.current)setError(messageOf(error));}
    finally{closing.current=false;if(mounted.current)setGameAction(null);}
  }
  const GameComponent=active?(active.presentation.kind==='learning'?OnlineExerciseRunner:GAME_COMPONENTS[active.session.moduleId]):null;
  const gameProps:GameHostProps|null=active?{pack:active.presentation,onAttempt:recordAttempt,onComplete:completeGame,onExit:()=>void leaveGame(),questionMode:active.session.rewardPolicyVersion===2,serverScored:active.session.questionProtocolVersion===1,mediaPlayId:active.session.sessionId,onQuestionHint:(itemId)=>onlineApi.questionHint(active.session.sessionId,itemId),onQuestionOpen:(itemId)=>onlineApi.openQuestion(active.session.sessionId,itemId)}:null;
  const currentSets=state?.weeks.find(week=>week.current)?.sets??[];
  const hubSets=state?.current&&!currentSets.some(set=>set.pack.id===state.current!.pack.id&&set.pack.version===state.current!.pack.version)?[state.current,...currentSets]:currentSets;
  const fallbackOverview:MapOverviewResponse={
    schemaVersion:1,
    currentWeek:state?.currentWeekSummary?{weekId:state.currentWeekSummary.weekId,position:state.currentWeekSummary.position,title:state.currentWeekSummary.title,ready:state.currentWeekSummary.ready,hasNext:state.currentWeekSummary.hasNext}:null,
    totalWeeks:state?.weeks.length??0,
    maxPosition:state?Math.max(...state.weeks.map(w=>w.position),0):0,
    regions:[
      {id:'math',label:'Toán học',assignedWeekCount:0,closedWeekCount:0,hasCurrentWeek:false},
      {id:'vietnamese',label:'Tiếng Việt',assignedWeekCount:0,closedWeekCount:0,hasCurrentWeek:false},
      {id:'english',label:'Tiếng Anh',assignedWeekCount:0,closedWeekCount:0,hasCurrentWeek:false},
      {id:'computing',label:'Tin học',assignedWeekCount:0,closedWeekCount:0,hasCurrentWeek:false},
    ],
    regionView:null
  };
  const fallbackRegionView:RegionMapView={
    regionId:selectedRegion??'math',
    chapter:selectedChapter,
    totalChapters:1,
    startPosition:1,
    endPosition:7,
    nodes:[]
  };
  const selectedNode=mapData?.regionView?.nodes.find(n=>n.weekId===selectedWeekId)??null;
  const matchedWeek=selectedWeekId?state?.weeks.find(w=>w.id===selectedWeekId)??null:null;
  return <div className="app-shell focused-games-app ba-frame-shell online-app online-student" data-motion={motionOn?'on':'off'}>
    <StudentHeader
      identity={identity}
      state={state}
      mapMode={mapMode}
      activeSection={contestOpen?'contest':townOpen?'town':'map'}
      isMobile={isMobile}
      onToggleMap={()=>{
        if(contestOpen||townOpen){
          setContestOpen(false);
          setTownOpen(false);
          setMapMode('map');
        }else{
          setMapMode(m=>m==='map'?'list':'map');
        }
      }}
      onOpenTown={()=>{setContestOpen(false);setTownOpen(true);}}
      onOpenContest={()=>{setTownOpen(false);setContestOpen(true);}}
      onOpenStreak={()=>setStreakOpen(true)}
      onOpenMissions={()=>setMissionsOpen(true)}
      onOpenBadges={()=>setBadgesOpen(true)}
      onOpenNotebook={()=>setNotebookOpen(true)}
      onOpenParentPin={()=>setParentPinOpen(true)}
      onOpenWallet={()=>setWalletOpen(true)}
      soundOn={soundOn}
      onToggleSound={()=>setSoundOn(v=>!v)}
      motionOn={motionOn}
      onToggleMotion={()=>setMotionOn(v=>!v)}
      onOpenPassword={openPassword}
      onLogout={async()=>{
        try{await onLogout();}catch(error){setError(messageOf(error));}
      }}
      unlockedDiscoveryCount={unlockedDiscoveryCards.length}
      disabled={starting||refreshing}
      inert={!!active||walletOpen||giftShelfOpen||passwordOpen||advanceOpen||streakOpen||missionsOpen||badgesOpen||parentPinOpen||parentPortalOpen}
    />
    <main ref={studentMain} tabIndex={-1} className={`site-main site-main-gameworld ${contestOpen?'is-contest-mode':townOpen?'is-town-mode':mapMode==='map'?'is-map-mode':'is-list-mode'}`} aria-busy={starting||refreshing||loadingMore} inert={!!active||walletOpen||giftShelfOpen||passwordOpen||advanceOpen||streakOpen||missionsOpen||badgesOpen||parentPinOpen||parentPortalOpen}>
      {error&&!active&&<div className="online-notice online-error" role="alert">{error}<button onClick={()=>void refresh().catch(error=>setError(messageOf(error)))}>Thử kết nối lại</button></div>}
      {contestOpen?(
        <Suspense fallback={<p className="online-loading" role="status">Đang mở phòng thi thử…</p>}>
          <ContestMockScreen
            initialPresetId={contestPresetId}
            onClose={()=>{
              setContestOpen(false);
              setContestPresetId(undefined);
              void refresh();
            }}
            onStartPracticeWithPack={async (reviewPack)=>{
              setContestOpen(false);
              setContestPresetId(undefined);
              await startGame('math-quest', reviewPack as any);
            }}
          />
        </Suspense>
      ):townOpen?(
        <Suspense fallback={<p className="online-loading" role="status">Đang mở thị trấn của con…</p>}>
          <TownScreen
            onBack={()=>{
              setTownOpen(false);
              void refresh();
            }}
            studentId={state?.student.id}
          />
        </Suspense>
      ):loading?<p className="online-loading" role="status">Đang mở hành trình của con…</p>:state?<>
        <GoalBar goal={state.goal??null} availableStars={state.balance.available} onOpenShelf={()=>setGiftShelfOpen(true)} disabled={starting||refreshing}/>
        {state.weeks.length>0?<>
          {mapMode==='map'?(
            mapView==='world'?(
              <WorldMap
                overview={mapData??fallbackOverview}
                currentWeek={state.currentWeekSummary}
                currentSet={state.current??hubSets[0]??null}
                allSets={hubSets}
                onSelectRegion={handleSelectRegion}
                onContinueCurrent={state.currentWeekSummary?handleContinueCurrent:undefined}
                onPlayGame={startGame}
                onOpenListView={()=>setMapMode('list')}
                onRefresh={()=>void refresh().catch(error=>{if(error?.name!=='AbortError')setError(messageOf(error));})}
                disabled={starting||refreshing}
              />
            ):selectedRegion?(
              <div className="region-map-layout">
                <RegionMap
                  regionId={selectedRegion}
                  regionView={mapData?.regionView??fallbackRegionView}
                  selectedWeekId={selectedWeekId}
                  onSelectWeek={handleSelectWeek}
                  onChangeChapter={handleChangeChapter}
                  onBackToWorld={handleBackToWorld}
                  onOpenListView={()=>setMapMode('list')}
                  onRefresh={()=>void refresh().catch(error=>{if(error?.name!=='AbortError')setError(messageOf(error));})}
                  disabled={starting||refreshing}
                />
                {selectedNode && (
                  <>
                    <div
                      className="map-week-panel-backdrop"
                      onClick={() => setSelectedWeekId(null)}
                      aria-hidden="true"
                    />
                    <MapWeekPanel
                      node={selectedNode}
                      summaryWeek={matchedWeek}
                      onPlayGame={startGame}
                      onChooseGames={chooseReplay}
                      onAdvanceWeek={state.currentWeekSummary?.ready&&state.currentWeekSummary.hasNext?()=>setAdvanceOpen(true):undefined}
                      onClose={()=>setSelectedWeekId(null)}
                      disabled={starting||refreshing}
                      reviewEpoch={reviewEpoch}
                    />
                  </>
                )}
              </div>
            ):null
          ):(
            <>
              <div className="list-mode-nav-banner">
                <button
                  type="button"
                  className="back-to-map-btn"
                  onClick={()=>setMapMode('map')}
                  aria-label="🗺️ Bản đồ học tập"
                >
                  ← 🗺️ Quay lại Bản đồ thế giới
                </button>
                <div className="view-toggle-group" role="group" aria-label="Chế độ hiển thị">
                  <button type="button" className="view-toggle-btn" onClick={()=>setMapMode('map')}>🗺️ Bản đồ</button>
                  <button type="button" className="view-toggle-btn active" onClick={()=>setMapMode('list')} aria-pressed="true">📋 Danh sách</button>
                </div>
              </div>
              <StudentScreen studentName={state.student.name} availableStars={state.balance.available} earnedStars={state.balance.earned} sets={hubSets} week={state.currentWeekSummary} practiceContext={{title:state.current?.weekTitle??'Hành trình của con',detail:state.current?`${state.current.subjectLabel} · ${state.current.pack.title}`:state.weeks.length?'Con đã hoàn thành tất cả học liệu được giao.':'Quản trị viên đang chuẩn bị học liệu cho lớp.',pack:state.current?.pack??null,games:state.current?.games??[],complete:state.weeks.length>0&&!state.current}} onPlay={startGame} onChooseGames={chooseReplay} starting={starting||!!active} onOpenWallet={()=>setWalletOpen(true)} showCardBlock={true}/>
              <section id="online-week-journey" className={`online-student-weeks ${journeyExpanded?'is-expanded':'is-collapsed'}`} aria-label="Học liệu được giao">
                <div className="online-section-head">
                  <h2>Hành trình theo tuần</h2>
                  <div className="online-section-actions">
                    <button type="button" className="online-journey-toggle-btn" onClick={()=>setJourneyExpanded(v=>!v)} aria-expanded={journeyExpanded}>
                      {journeyExpanded?'Thu gọn hành trình ▴':'Xem cả hành trình ▾'}
                    </button>
                    <button disabled={starting||refreshing||loadingMore} onClick={()=>void refresh().catch(error=>{if(error?.name!=='AbortError')setError(messageOf(error));})}>
                      {refreshing?'Đang làm mới…':'Làm mới tiến độ'}
                    </button>
                  </div>
                </div>
                <p>Mỗi câu cần ít nhất 2 sao để hoàn thành tuần. Con có thể ôn lên 3 sao trước khi xác nhận sang tuần mới; tuần đã qua sẽ khóa.</p>
                {state.currentWeekSummary&&<div className="online-week-progress" aria-label="Tiến độ tuần hiện tại"><strong>{state.currentWeekSummary.title}: {state.currentWeekSummary.total-state.currentWeekSummary.zero-state.currentWeekSummary.one}/{state.currentWeekSummary.total} câu đạt yêu cầu</strong><p>{state.currentWeekSummary.two} câu 2 sao · {state.currentWeekSummary.three} câu 3 sao</p>{state.currentWeekSummary.ready?<><p>Con đã hoàn thành yêu cầu của tuần.{state.currentWeekSummary.two>0?` Còn ${state.currentWeekSummary.two} câu 2 sao; con có muốn ôn để kiếm 3 sao không?`:' Tất cả câu đã đạt 3 sao.'}</p><div className="online-actions">{state.currentWeekSummary.two>0&&<button type="button" disabled={starting||loadingMore} onClick={()=>{setReviewEpoch(value=>value+1);if(state.page.cursor!==state.currentWeekSummary!.cursor)void loadPage('current');}}>Ôn lại các câu 2 sao</button>}<button type="button" className="online-primary" disabled={!state.currentWeekSummary.hasNext||starting} onClick={()=>setAdvanceOpen(true)}>{state.currentWeekSummary.hasNext?`Sang ${state.currentWeekSummary.nextWeekTitle}`:'Chưa có tuần tiếp theo'}</button></div></>:<p>Còn {state.currentWeekSummary.zero+state.currentWeekSummary.one} câu chưa đạt 2 sao. Sao của từng câu được giữ khi con đổi trò hoặc học lại.</p>}</div>}
                {state.weeks.length?<ol className="online-week-path">{state.weeks.map(week=><li key={week.id} id={`online-week-${week.id}`} className={week.closed?'is-done':week.current?'is-current':'is-locked'}><strong>{week.closed?'🔒 Đã qua · ':week.current?'▶ ':'🔒 '}{week.title}</strong>{week.closed&&<p>Tuần này đã khóa sau khi chuyển tuần.</p>}<ul>{week.sets.map(set=><li key={`${set.pack.id}@${set.pack.version}`}><span>{set.subjectLabel} · {set.pack.title}</span><span>{set.questionProgress.two} câu 2 sao · {set.questionProgress.three} câu 3 sao</span>{week.current&&<OnlineQuestionStars set={set} disabled={starting||!!active} reviewEpoch={reviewEpoch} onChooseGames={()=>chooseReplay(set.pack)} onPlay={(game,ids)=>void startGame(game,set.pack,ids)}/>}</li>)}</ul></li>)}</ol>:<p>Lớp chưa có tuần học nào. Con quay lại sau khi quản trị viên giao học liệu nhé.</p>}
                <div className="online-actions online-journey-pages">{Number(state.page.cursor)>0&&<button type="button" disabled={loadingMore||starting} onClick={()=>void loadPage(String(Math.max(0,Number(state.page.cursor)-20)))}>Xem tóm tắt các bộ trước</button>}{state.currentWeekSummary&&state.page.cursor!==state.currentWeekSummary.cursor&&<button type="button" disabled={loadingMore||starting} onClick={()=>void loadPage('current')}>Xem tuần đang học</button>}{state.page.nextCursor&&<button type="button" disabled={loadingMore||starting||!!active} onClick={()=>void loadPage(state.page.nextCursor!)}>{loadingMore?'Đang tải…':'Xem thêm tuần học'}</button>}</div>
              </section>
            </>
          )}
        </>:<section className="online-student-empty" aria-label="Chờ giáo viên giao học liệu">
          <EmptyState
            icon="sparkles"
            message="Khi giáo viên giao bộ câu hỏi tuần cho lớp, bài học và trò chơi phù hợp sẽ xuất hiện ở đây."
            actionLabel="Ví đổi sao"
            onAction={()=>setWalletOpen(true)}
          >
            <h1>Chờ bộ câu hỏi của thầy cô</h1>
            <p>⭐ {state.balance.available} sao</p>
          </EmptyState>
        </section>}
      </>:<EmptyState icon="refresh" title="Chưa mở được thông tin tài khoản" message="Không thể tải thông tin hành trình. Con hãy kiểm tra kết nối và thử lại nhé." actionLabel="Thử lại" onAction={()=>void refresh().catch(error=>setError(messageOf(error)))} className="online-loading" />}
    </main>
    {starting&&<div className="online-student-status" role="status">{selectingPack?'Đang tải trò phù hợp…':'Đang mở trò chơi…'}</div>}
    {active&&GameComponent&&gameProps&&(()=>{
      const activeSet=state?.weeks.flatMap(w=>w.sets).find(s=>s.pack.id===active.pack.id);
      const activeWeek=state?.weeks.find(w=>w.sets.some(s=>s.pack.id===active.pack.id));
      const activeSubjectLabel=activeSet?.subjectLabel??'HỌC LIỆU ĐƯỢC GIAO';
      const activeRegionId=resolveRegionId(activeSubjectLabel);
      const activeSlot=activeWeek?getSlotFromPosition(activeWeek.position):1;
      const activeLandmarkUrl=getLandmark(activeRegionId,activeSlot);
      const activeRegionKey=activeRegionId==='discovery'?'world':activeRegionId;
      const activeRegionBgWide=`/art/maps/map-${activeRegionKey}-wide.webp`;
      const activeRegionBgTall=`/art/maps/map-${activeRegionKey}-tall.webp`;
      return (
        <div className="overlay immersive-overlay" role="presentation">
          <div className={`game-dialog adventure-dialog immersive-dialog premium-game dialog-${active.session.moduleId} dialog-region-${activeRegionId}`} data-scene-engine="html" data-scene-state="ready" ref={gameDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-busy={gameAction!==null} aria-label={`Đang chơi ${active.pack.title}`}>
            <div className="game-region-backdrop" style={{backgroundImage:`url(${activeRegionBgWide})`}} aria-hidden="true">
              <picture>
                <source media="(max-width: 768px), (orientation: portrait)" srcSet={activeRegionBgTall} type="image/webp" />
                <img src={activeRegionBgWide} alt="" className="game-region-backdrop-img" loading="eager" />
              </picture>
            </div>
            <div className="game-dialog-head">
              <div className="game-dialog-head-info">
                <img src={activeLandmarkUrl} alt="" className="game-stage-corner-landmark" aria-hidden="true" />
                <div>
                  <span className="eyebrow">{activeSubjectLabel}</span>
                  <h2>{active.pack.title}</h2>
                </div>
              </div>
              <div className="game-dialog-head-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="game-dialog-stars-pill" aria-label={`Ví sao: ${state?.balance.available ?? 0} sao`} style={{ background: 'rgba(255, 255, 255, 0.18)', borderRadius: '14px', padding: '4px 10px', fontSize: '13px', fontWeight: 700 }}>
                  ⭐ {state?.balance.available ?? 0}
                </span>
                <button className="button outline" disabled={gameAction!==null} onClick={()=>void leaveGame()}>{gameAction==='exit'?'Đang trở về…':'← Thoát trò chơi'}</button>
              </div>
            </div>
            {gameAction&&<div className={`online-game-request-status ${gameAction==='exit'?'is-leaving':''}`} role="status">{gameAction==='answer'?'Đang lưu câu trả lời…':gameAction==='complete'?'Đang lưu kết quả hoàn thành…':'Đang trở về hành trình…'}</div>}
            {error&&<p className="online-notice online-error" role="alert">{error} Con có thể thử lại thao tác vừa rồi.</p>}
            {questionNotice&&active.session.rewardPolicyVersion===2&&<div className="game-star-receipt question-star-receipt" role="status">{questionNotice}</div>}
            {reward&&<div className="game-star-receipt" role="status">{reward.gained?`⭐ +${reward.gained} sao mới`:'Đã giữ mức sao cao nhất'} · Bộ này đạt {reward.tier}/3 sao. Máy chủ đã lưu thành tích.</div>}
            <QuestionMediaScope key={active.session.sessionId} scope={active.session.sessionId}><AsyncBoundary label="trò chơi" onExit={()=>void leaveGame()}><Suspense fallback={<p className="loading-state">Đang tải trò chơi…</p>}><GameComponent key={active.session.sessionId} {...gameProps}/></Suspense></AsyncBoundary></QuestionMediaScope>
          </div>
        </div>
      );
    })()}
    {activeDiscovery&&<DiscoveryCardDialog discovery={activeDiscovery.pack.discovery!} subjectLabel={activeDiscovery.subjectLabel} packTitle={activeDiscovery.pack.title} soundOn={soundOn} onClose={handleCloseDiscovery}/>}
    {notebookOpen&&<DiscoveryNotebookDialog cards={unlockedDiscoveryCards} onClose={()=>setNotebookOpen(false)} onExplore={()=>{setContestOpen(false);setTownOpen(false);setMapMode('map');setMapView('world');}}/>}
    {advanceOpen&&state?.currentWeekSummary&&<AsyncBoundary label="xác nhận chuyển tuần" onExit={()=>setAdvanceOpen(false)}><Suspense fallback={<p className="online-loading" role="status">Đang mở xác nhận chuyển tuần…</p>}><OnlineWeekAdvanceDialog week={state.currentWeekSummary} onClose={()=>setAdvanceOpen(false)} onConfirm={advanceWeek}/></Suspense></AsyncBoundary>}
    {passwordOpen&&<AsyncBoundary label="biểu mẫu đổi mật khẩu" onExit={()=>setPasswordOpen(false)}><Suspense fallback={<p className="online-loading" role="status">Đang mở biểu mẫu đổi mật khẩu…</p>}><OnlinePasswordDialog onClose={()=>{setPasswordOpen(false);void refresh().catch(error=>setError(messageOf(error)));}} onChanged={onPasswordChanged}/></Suspense></AsyncBoundary>}
    {giftShelfOpen&&state&&<AsyncBoundary label="kệ quà" onExit={()=>setGiftShelfOpen(false)}><Suspense fallback={<p className="online-loading" role="status">Đang mở kệ quà…</p>}><GiftShelfDialog state={state} onRefresh={refresh} onClose={()=>setGiftShelfOpen(false)} onOpenLegacyWallet={()=>setWalletOpen(true)} onAskParentsAddGift={()=>setParentPinOpen(true)}/></Suspense></AsyncBoundary>}
    {walletOpen&&state&&<OnlineWallet state={state} onRefresh={refresh} onClose={()=>setWalletOpen(false)}/>}
    {streakOpen&&<AsyncBoundary label="chuỗi ngày học" onExit={()=>setStreakOpen(false)}><Suspense fallback={<p className="online-loading" role="status">Đang mở chuỗi ngày học…</p>}><StreakDialog streak={state?.streak} onClose={()=>setStreakOpen(false)}/></Suspense></AsyncBoundary>}
    {missionsOpen&&<AsyncBoundary label="nhiệm vụ hôm nay" onExit={()=>setMissionsOpen(false)}><Suspense fallback={<p className="online-loading" role="status">Đang mở nhiệm vụ hôm nay…</p>}><DailyMissionDialog missions={state?.dailyMissions} riddle={state?.dailyRiddle} onClose={()=>setMissionsOpen(false)} onRefreshSummary={()=>void refresh()}/></Suspense></AsyncBoundary>}
    {badgesOpen&&<AsyncBoundary label="huy hiệu" onExit={()=>setBadgesOpen(false)}><Suspense fallback={<p className="online-loading" role="status">Đang mở bộ huy hiệu…</p>}><BadgeShowcaseDialog badges={state?.badges} onClose={()=>setBadgesOpen(false)}/></Suspense></AsyncBoundary>}
    {parentPinOpen&&(
      <Suspense fallback={null}>
        <ParentPinModal
          studentId={identity.user.studentId}
          hasPin={state?.hasParentPin ?? false}
          onSuccess={dash=>{
            setParentDashboardData(dash);
            setParentPinOpen(false);
            setParentPortalOpen(true);
          }}
          onClose={()=>setParentPinOpen(false)}
        />
      </Suspense>
    )}
    {parentPortalOpen&&parentDashboardData&&(
      <div className="parent-portal-overlay-modal" role="dialog" aria-modal="true" aria-label="Khu phụ huynh">
        <Suspense fallback={<p className="online-loading" role="status">Đang mở khu phụ huynh…</p>}>
          <ParentPortalScreen
            identity={identity}
            initialData={parentDashboardData}
            onClose={()=>{
              setParentPortalOpen(false);
              setParentDashboardData(null);
              void refresh();
            }}
          />
        </Suspense>
      </div>
    )}
    {isMobile&&(
      <StudentBottomNav
        activeTab={giftShelfOpen?'shelf':missionsOpen?'missions':contestOpen?'contest':townOpen?'town':'map'}
        onNavigateHome={()=>{
          setContestOpen(false);
          setTownOpen(false);
          setMapMode('map');
          setMapView('world');
          setSelectedRegion(null);
          setSelectedWeekId(null);
        }}
        onOpenMissions={()=>setMissionsOpen(true)}
        onOpenTown={()=>{setContestOpen(false);setTownOpen(true);}}
        onOpenGiftShelf={()=>setGiftShelfOpen(true)}
        onOpenContest={()=>{setTownOpen(false);setContestOpen(true);}}
        missions={state?.dailyMissions}
        disabled={starting||refreshing||!!active}
        inert={!!active||walletOpen||giftShelfOpen||passwordOpen||advanceOpen||streakOpen||missionsOpen||badgesOpen||parentPinOpen||parentPortalOpen}
      />
    )}
  </div>;
}
