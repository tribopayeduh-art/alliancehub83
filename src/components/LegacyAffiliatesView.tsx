import {periodValue} from '../lib/periodMetrics';
import {AffiliateNetworkRow} from './AffiliateNetworkRow';
import {downloadReportCsv} from '../lib/reportExport';
import {loadAffiliateInfo} from '../lib/loadAffiliateInfo';
import {Modal} from './Modal';
import {useWorkspaceMobile} from '../lib/useWorkspaceMobile';
import '../styles/affiliate-clean.css';
import '../styles/affiliate-polished.css';
import { readApiJson } from '../lib/readApiJson';
import {useDashboardMotion} from '../lib/useDashboardMotion';
import {InexLoader} from './InexLoader';
import React, { useState, useEffect, useMemo } from 'react';
import { AffiliateInfo, IndicationItem, InfluencerCommissionRequest, PlayerWithdrawalRequest, User } from '../types';
import { ReferralCard } from './ReferralCard';
import { ManageIndicatedModal } from './ManageIndicatedModal';
import { AffiliateWithdrawModal } from './AffiliateWithdrawModal';
import { Pagination } from './Pagination';
import { Users, ShieldCheck, UserCheck, ArrowLeft, Settings, BarChart3, Wallet, TrendingUp, X, Coins, ArrowDownLeft, Search, Loader2, RotateCw, Sun, Moon, Bell, Gamepad2, UserPlus, BadgeDollarSign, Filter, ChevronRight, CheckCircle2, Clock3, Smartphone, Copy, Check, Crown } from 'lucide-react';
import logoImg from './inex-logo.svg';
import { getNotificationState, requestNotificationPermission, registerServiceWorker, triggerSaleNotification, syncNotificationPreferences } from '../lib/pwaNotification';

interface AffiliatesViewProps {
  affiliateInfo: AffiliateInfo | null;
  currentUser?: User | null;
  onBack?: () => void;
  onCopySuccess: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onOpenPartnerPanel?: () => void;
}

export const LegacyAffiliatesView: React.FC<AffiliatesViewProps> = ({
  affiliateInfo,
  currentUser,
  onBack,
  onCopySuccess,
  onShowToast,
  onRefresh,
  onOpenSettings,
  onOpenPartnerPanel,
}) => {
  useWorkspaceMobile('affiliate','home');
  useEffect(()=>{document.body.classList.add('inex-affiliate-open');return()=>document.body.classList.remove('inex-affiliate-open');},[]);
  const [activeSection,setActiveSection]=useState('af-overview');
  const jumpTo=(id:string)=>{setActiveSection(id);scrollToSection(id);};
  const scrollToSection=(id:string)=>document.getElementById(id)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  const [selectedIndication, setSelectedIndication] = useState<IndicationItem | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState<boolean>(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);
  const [influencerMetricsItem, setInfluencerMetricsItem] = useState<IndicationItem | null>(null);
  const [localIndications, setLocalIndications] = useState<IndicationItem[] | null>(null);
  const [filterType, setFilterType] = useState<'players' | 'influencers'>('players');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [depositFilter, setDepositFilter] = useState<'all' | 'deposited' | 'no_deposit'>('all');
  const [networkSort, setNetworkSort] = useState<'recent' | 'deposits' | 'name'>('recent');
  const [internalAffiliateInfo, setInternalAffiliateInfo] = useState<AffiliateInfo | null>(null);
  const [loadingInternal, setLoadingInternal] = useState<boolean>(true);
  const [infoError,setInfoError]=useState('');
  const [infoAttempt,setInfoAttempt]=useState(0);
  const [gameFilter, setGameFilter] = useState<'all' | 'g_count_masters' | 'g_block_puzzle' | 'g_bubble_blast' | 'g_gen_dino' | 'g_raspa_fortuna' | 'g_subway_pay'>('all');
  const [affiliateTheme, setAffiliateTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('affiliate_hub_theme') as 'light' | 'dark') || 'light');
  const [notificationMode, setNotificationMode] = useState<'simple' | 'detailed'>(() => (localStorage.getItem('affiliate_notification_mode') as 'simple' | 'detailed') || 'detailed');
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('affiliate_notification_prefs') || '') as { registration:boolean; ftd:boolean; pixPending:boolean; gameActivity:boolean }; }
    catch { return { registration: true, ftd: true, pixPending: false, gameActivity: true }; }
  });
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(() => getNotificationState().permission === 'granted');
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  const isAdmin = useMemo(() => {
    const role = currentUser?.role?.toLowerCase();
    return role === 'admin' || 
      role === 'superadmin';
  }, [currentUser]);

  const isApprovedPartner = useMemo(() => {
    return Boolean(
      isAdmin ||
      (currentUser?.isPartner === true && currentUser?.partnerApproved === true)
    );
  }, [isAdmin, currentUser]);

  const [opsScope, setOpsScope] = useState<'influencers' | 'all' | 'direct'>('all');
  const [opsTimeFilter, setOpsTimeFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [opsSearch, setOpsSearch] = useState<string>('');
  const [opsSortBy, setOpsSortBy] = useState<'revenue' | 'ftds' | 'registrations' | 'conversion'>('revenue');
  const [opsActiveTab, setOpsActiveTab] = useState<'metrics' | 'ranking' | 'feed'>('metrics');
  const [isRefreshingOps, setIsRefreshingOps] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Agora');
  useEffect(() => { localStorage.setItem('affiliate_hub_theme', affiliateTheme); }, [affiliateTheme]);
  useEffect(() => { localStorage.setItem('affiliate_notification_mode', notificationMode); }, [notificationMode]);
  useEffect(() => {
    localStorage.setItem('affiliate_notification_prefs', JSON.stringify(notificationPrefs));
    syncNotificationPreferences(notificationPrefs);
  }, [notificationPrefs]);

  const enableAffiliateNotifications = async () => {
    const res = await requestNotificationPermission();
    await registerServiceWorker();
    localStorage.setItem('pg_gateway_notifications', 'true');
    setBrowserNotificationsEnabled(true);
    await triggerSaleNotification({ customTitle: 'Notificações ativadas! 🔔', customSubtitle: 'Você receberá os eventos e novidades no Programa de Afiliados.' });
    if (res.isIframe && !res.granted) {
      onShowToast?.('Notificações In-App ativadas com som! (Para Push nativo no SO, abra o app em uma nova aba).', 'info');
    } else {
      onShowToast?.('Notificações ativadas com sucesso!', 'success');
    }
  };

  useEffect(()=>{
    if(affiliateInfo){setLoadingInternal(false);setInfoError('');return;}
    const controller=new AbortController();let disposed=false;
    setLoadingInternal(true);setInfoError('');
    const token=localStorage.getItem('pg_auth_token')||localStorage.getItem('paygateway_token')||localStorage.getItem('token')||'';
    loadAffiliateInfo(token,{signal:controller.signal}).then(data=>{if(!disposed){setInternalAffiliateInfo(data);setLocalIndications(data.indications||[]);}}).catch(error=>{if(!disposed&&error.name!=='AbortError')setInfoError(error.message||'Não foi possível carregar o programa de afiliados.');}).finally(()=>{if(!disposed)setLoadingInternal(false);});
    return()=>{disposed=true;controller.abort();};
  },[affiliateInfo,infoAttempt,currentUser?.id]);

  const activeInfo = affiliateInfo || internalAffiliateInfo;
  const motionRef=useDashboardMotion(`${!!activeInfo}:${opsActiveTab}`);

  const rawIndicationsList = localIndications || activeInfo?.indications || [];

  const filteredIndications = rawIndicationsList.filter((ind) => {
    const matchesType = filterType === 'players' ? !ind.isInfluencer : ind.isInfluencer;
    if (!matchesType) return false;
    const deposited = Number(ind.totalDeposited || 0) + Number(ind.subNetworkDeposits || 0) > 0;
    if (depositFilter === 'deposited' && !deposited) return false;
    if (depositFilter === 'no_deposit' && deposited) return false;
    const itemGame = ind.registeredGame || ind.lastGameId || 'g_block_puzzle';
    if (gameFilter !== 'all' && itemGame !== gameFilter) return false;
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    return (
      (ind.referredName && ind.referredName.toLowerCase().includes(query)) ||
      (ind.referredEmail && ind.referredEmail.toLowerCase().includes(query))
    );
  }).sort((a, b) => {
    if (networkSort === 'deposits') return (Number(b.totalDeposited || 0) + Number(b.subNetworkDeposits || 0)) - (Number(a.totalDeposited || 0) + Number(a.subNetworkDeposits || 0));
    if (networkSort === 'name') return String(a.referredName || '').localeCompare(String(b.referredName || ''), 'pt-BR');
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });

  const eventsFor=(ind:IndicationItem)=>ind.isInfluencer&&opsScope!=='all'?(ind.networkPeriodEvents||[]):(ind.directPeriodEvents||[]);
  const getItemRevenue = (ind: IndicationItem) => {
    if(opsTimeFilter!=='all')return periodValue(eventsFor(ind),'deposit',opsTimeFilter);
    if(opsScope==='all')return Number(ind.totalDeposited||0);
    if (ind.isInfluencer) {
      return Number(ind.subNetworkDeposits || 0) + Number(ind.totalDeposited || 0);
    }
    return Number(ind.totalDeposited || 0);
  };

  const getItemRegistrations = (ind: IndicationItem) => {
    if(opsTimeFilter!=='all')return periodValue(eventsFor(ind),'signup',opsTimeFilter);
    if(opsScope==='all')return 1;
    if (ind.isInfluencer) {
      return Number(ind.subReferralsCount || 0) || 1;
    }
    return 1;
  };

  const getItemFtds = (ind: IndicationItem) => {
    if(opsTimeFilter!=='all')return periodValue(eventsFor(ind),'ftd',opsTimeFilter);
    if(opsScope==='all')return Number(ind.totalDeposited||0)>0?1:0;
    return Number(ind.ftdCount || 0);
  };

  const getItemConversion = (ind: IndicationItem) => {
    const regs = getItemRegistrations(ind);
    const ftds = getItemFtds(ind);
    if (regs <= 0) return 0;
    return (ftds / regs) * 100;
  };

  const handleManualSync = async () => {
    setIsRefreshingOps(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
      const data=await loadAffiliateInfo(token||'');
      setInternalAffiliateInfo(data);setLocalIndications(data.indications||[]);
      const now = new Date();
      setLastSyncedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
      onShowToast?.('Métricas operacionais sincronizadas em tempo real!', 'success');
    } catch (e) {
      console.error(e);
      onShowToast?.('Erro ao atualizar métricas.', 'error');
    } finally {
      setIsRefreshingOps(false);
    }
  };

  const allInfluencers = rawIndicationsList.filter(ind => ind.isInfluencer);

  const scopedIndications = rawIndicationsList.filter((ind) => {
    if (opsScope === 'influencers') return ind.isInfluencer;
    if (opsScope === 'direct') return !ind.isInfluencer;
    return true; // 'all'
  }).filter((ind) => {
    const itemGame = ind.registeredGame || ind.lastGameId || 'g_block_puzzle';
    if (gameFilter !== 'all' && itemGame !== gameFilter) return false;
    return true;
  });

  const filteredRankingList = scopedIndications.filter((ind) => {
    if (!opsSearch.trim()) return true;
    const q = opsSearch.toLowerCase();
    return (
      (ind.referredName && ind.referredName.toLowerCase().includes(q)) ||
      (ind.referredEmail && ind.referredEmail.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    if (opsSortBy === 'ftds') return getItemFtds(b) - getItemFtds(a);
    if (opsSortBy === 'registrations') return getItemRegistrations(b) - getItemRegistrations(a);
    if (opsSortBy === 'conversion') return getItemConversion(b) - getItemConversion(a);
    // default: revenue
    return getItemRevenue(b) - getItemRevenue(a);
  });

  // 40 items per page pagination state for indications and ranking
  const INDICATIONS_PAGE_SIZE = 40;
  const [indicationsPage, setIndicationsPage] = useState<number>(1);

  const RANKING_PAGE_SIZE = 40;
  const [rankingPage, setRankingPage] = useState<number>(1);

  // Reset indications page when filters/search/sorting changes
  useEffect(() => {
    setIndicationsPage(1);
  }, [filterType, depositFilter, gameFilter, searchTerm, networkSort]);

  // Reset ranking page when ops scope/filters change
  useEffect(() => {
    setRankingPage(1);
  }, [opsScope, gameFilter, opsTimeFilter, opsSearch, opsSortBy]);

  // Paginated Slices (40 per page)
  const paginatedIndications = useMemo(() => {
    const start = (indicationsPage - 1) * INDICATIONS_PAGE_SIZE;
    return filteredIndications.slice(start, start + INDICATIONS_PAGE_SIZE);
  }, [filteredIndications, indicationsPage, INDICATIONS_PAGE_SIZE]);

  const paginatedRankingList = useMemo(() => {
    const start = (rankingPage - 1) * RANKING_PAGE_SIZE;
    return filteredRankingList.slice(start, start + RANKING_PAGE_SIZE);
  }, [filteredRankingList, rankingPage, RANKING_PAGE_SIZE]);

  if (!activeInfo) {
    return (
      <div className="affiliate-hub-view affiliate-clean space-y-6 pb-24 px-4 pt-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center text-[#111111] hover:bg-[#ECECEC] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-[#111111] tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-[#111111]" />
              Programa de Afiliados
            </h1>
            <p className="text-xs text-[#737373]">{loadingInternal ? 'Carregando seus dados…' : 'Não foi possível concluir a consulta.'}</p>
          </div>
        </div>

        <div role={infoError?'alert':'status'} className="bg-white p-8 rounded-[24px] border border-[#E5E5E5] flex flex-col items-center justify-center text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-[#111111] border border-slate-100 animate-pulse">
            {loadingInternal ? <InexLoader compact /> : <ShieldCheck size={22}/>}
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#111111]">{loadingInternal ? 'Carregando programa de afiliados' : 'Não foi possível abrir o programa de afiliados'}</h3>
            <p className="text-xs text-[#737373] mt-1 max-w-xs">
              {loadingInternal ? 'Buscando seu link de indicação, comissões e métricas da rede.' : infoError || 'Tente novamente para consultar seus dados.'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {(
              <button
                onClick={()=>{setInfoAttempt(n=>n+1);onRefresh?.();}} disabled={loadingInternal}
                className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                {loadingInternal ? 'Consultando…' : 'Tentar novamente'}
              </button>
            )}
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const operationTotals = {
    revenue: scopedIndications.reduce((sum, ind) => sum + getItemRevenue(ind), 0),
    registrations: scopedIndications.reduce((sum, ind) => sum + getItemRegistrations(ind), 0),
    ftds: scopedIndications.reduce((sum, ind) => sum + getItemFtds(ind), 0),
    activeInfluencers: allInfluencers.length,
    totalMembers: rawIndicationsList.length,
  };

  const conversionPercentage = operationTotals.registrations > 0
    ? ((operationTotals.ftds / operationTotals.registrations) * 100)
    : 0;

  const averageTicket = operationTotals.ftds > 0
    ? (operationTotals.revenue / operationTotals.ftds)
    : 0;

  return (
    <div ref={motionRef} className={`affiliate-hub-view affiliate-clean affiliate-ops-theme space-y-4 pb-24 px-2 sm:px-3 lg:px-4 pt-2 sm:pt-3.5 lg:pb-28 ${affiliateTheme === 'dark' ? 'is-dark' : ''}`}>
      {/* Top Bar with back if rendered as subview */}
      <div className="affiliate-hub-heading flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Voltar"
            className="w-8 h-8 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center text-[#111111] hover:bg-[#ECECEC] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[#111111] tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#111111]" />
            Programa de Afiliados
          </h1>
          <p className="text-xs text-[#737373]">Sua rede, seus resultados e seus próximos passos em um só lugar.</p>
        </div>
        <span className="affiliate-version-badge lg:hidden">v5</span>
        <button onClick={() => setAffiliateTheme(theme => theme === 'light' ? 'dark' : 'light')} className="affiliate-theme-button affiliate-theme-mobile lg:hidden" aria-label="Alternar tema claro ou escuro">{affiliateTheme === 'light' ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>}</button>
        <div className="hidden lg:flex ml-auto items-center gap-2">
          <button onClick={() => setAffiliateTheme(theme => theme === 'light' ? 'dark' : 'light')} className="affiliate-theme-button" title="Alternar tema">{affiliateTheme === 'light' ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>}<span>{affiliateTheme === 'light' ? 'Escuro' : 'Claro'}</span></button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Rede ativa
          </span>
          <span className="affiliate-version-badge">Hub v5</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500">
            Código {activeInfo.referralCode}
          </span>
        </div>
      </div>

      <nav className="af-section-nav" aria-label="Áreas do programa de afiliados"><button type="button" aria-current={activeSection==='af-overview'?'location':undefined} onClick={()=>jumpTo('af-overview')}><Wallet size={16}/>Minha conta</button><button type="button" aria-current={activeSection==='af-performance'?'location':undefined} onClick={()=>jumpTo('af-performance')}><BarChart3 size={16}/>Desempenho</button><button type="button" aria-current={activeSection==='af-network'?'location':undefined} onClick={()=>jumpTo('af-network')}><Users size={16}/>Minha rede</button></nav>
      {/* Referral Link & Overview Cards */}
      <div id="af-overview" className="affiliate-hub-overview">
        <ReferralCard
          affiliateInfo={activeInfo}
          onCopySuccess={onCopySuccess}
          onOpenWithdraw={() => setWithdrawModalOpen(true)}
        />
      </div>

      {/* Affiliate Operations Center */}
      <section id="af-performance" className="affiliate-operations-center">
        {/* Dynamic Toolbar: Scopes, Time Periods & Real-Time Sync */}
        <div className="affiliate-ops-toolbar">
          <div className="affiliate-scope-tabs overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setOpsScope('influencers')} aria-pressed={opsScope==='influencers'}
              className={`affiliate-scope-btn shrink-0 ${opsScope === 'influencers' ? 'active' : ''}`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Performance dos influenciadores</span>
              <span className="sm:hidden">Influenciadores</span>
            </button>
            <button
              type="button"
              onClick={() => setOpsScope('all')} aria-pressed={opsScope==='all'}
              className={`affiliate-scope-btn shrink-0 ${opsScope === 'all' ? 'active' : ''}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Toda a Rede</span>
            </button>
            <button
              type="button"
              onClick={() => setOpsScope('direct')} aria-pressed={opsScope==='direct'}
              className={`affiliate-scope-btn shrink-0 ${opsScope === 'direct' ? 'active' : ''}`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Jogadores Diretos</span>
              <span className="sm:hidden">Diretos</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-start w-full sm:w-auto">
            <div className="affiliate-time-tabs">
              <button
                type="button"
                onClick={() => setOpsTimeFilter('today')} aria-pressed={opsTimeFilter==='today'}
                className={`affiliate-time-btn ${opsTimeFilter === 'today' ? 'active' : ''}`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setOpsTimeFilter('7d')} aria-pressed={opsTimeFilter==='7d'}
                className={`affiliate-time-btn ${opsTimeFilter === '7d' ? 'active' : ''}`}
              >
                7 Dias
              </button>
              <button
                type="button"
                onClick={() => setOpsTimeFilter('30d')} aria-pressed={opsTimeFilter==='30d'}
                className={`affiliate-time-btn ${opsTimeFilter === '30d' ? 'active' : ''}`}
              >
                30 Dias
              </button>
              <button
                type="button"
                onClick={() => setOpsTimeFilter('all')} aria-pressed={opsTimeFilter==='all'}
                className={`affiliate-time-btn ${opsTimeFilter === 'all' ? 'active' : ''}`}
              >
                Geral
              </button>
            </div>

            <div className="affiliate-live-sync-wrap">
              <span className="affiliate-live-badge" title={`Última sincronização: ${lastSyncedTime}`}>
                <span className="affiliate-live-dot" />
                <span>DADOS DA REDE</span>
              </span>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isRefreshingOps}
                className="affiliate-sync-btn cursor-pointer"
                title="Sincronizar dados em tempo real"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshingOps ? 'animate-spin text-blue-600' : ''}`} />
                <span className="hidden sm:inline">{isRefreshingOps ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="affiliate-ops-header">
          <div>
            <span className="affiliate-eyebrow"><span /> VISÃO DA SUA REDE</span>
            <h2>
              {opsScope === 'influencers' ? 'Performance dos influenciadores' : opsScope === 'all' ? 'Operação Geral da Rede' : 'Performance dos Jogadores Diretos'}
            </h2>
            <p>Receita, cadastros e primeiros depósitos da sua rede.</p>
          </div>
          <div className="affiliate-ops-actions">
            {isApprovedPartner && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenPartnerPanel) {
                    onOpenPartnerPanel();
                  } else {
                    window.location.href = '/parceiros';
                  }
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 via-emerald-600 to-teal-700 hover:from-amber-600 hover:to-teal-800 text-white text-[11px] font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-emerald-400/30"
                title="Acessar Painel de Parceiro VIP (parceiro.goalliancehub.com ou /parceiros)"
              >
                <Crown className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                <span>Painel Parceiro</span>
              </button>
            )}

            <div className="affiliate-game-filter">
              <Filter className="w-3.5 h-3.5"/>
              <select value={gameFilter} onChange={e => setGameFilter(e.target.value as typeof gameFilter)}>
                <option value="all">Todos os jogos</option>
                <option value="g_count_masters">Count Masters</option>
                <option value="g_subway_pay">🏃 Subway Pay</option>
                <option value="g_bubble_blast">🫧 Bubble Blast</option>
                <option value="g_block_puzzle">🧩 Block Win</option>
                <option value="g_gen_dino">🦖 GEN DINO</option>
                <option value="g_raspa_fortuna">🍀 Raspa Fortuna</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onOpenSettings) {
                  onOpenSettings();
                } else {
                  setNotificationCenterOpen(true);
                }
              }}
              className="affiliate-notification-trigger cursor-pointer"
              aria-label="Abrir central de notificações"
            >
              <Bell className="w-4 h-4"/>
              <span>Notificações</span>
              <i>{Object.values(notificationPrefs).filter(Boolean).length}</i>
            </button>
          </div>
        </div>

        {/* The 4 KPI Cards */}
        <div className="affiliate-ops-kpis">
          <article>
            <i className="green"><BadgeDollarSign/></i>
            <div>
              <span>Volume de depósitos</span>
              <strong>R$ {operationTotals.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              <small>Depósitos da rede</small>
              {averageTicket > 0 && (
                <span className="affiliate-kpi-subpill green">
                  Ticket Médio: R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </article>

          <article>
            <i className="blue"><UserPlus/></i>
            <div>
              <span>Cadastros</span>
              <strong>{operationTotals.registrations}</strong>
              <small>Novos jogadores</small>
              <span className="affiliate-kpi-subpill blue">
                {scopedIndications.length} membros na amostra
              </span>
            </div>
          </article>

          <article>
            <i className="violet"><CheckCircle2/></i>
            <div>
              <span>FTDs confirmados</span>
              <strong>{operationTotals.ftds}</strong>
              <small>Primeiro depósito</small>
              <span className="affiliate-kpi-subpill amber">
                {operationTotals.ftds > 0 ? `${operationTotals.ftds} pagadores ativos` : 'Aguardando 1º depósito'}
              </span>
            </div>
          </article>

          <article>
            <i className="orange"><TrendingUp/></i>
            <div>
              <span>Conversão cadastro → FTD</span>
              <strong>{conversionPercentage.toFixed(1).replace('.', ',')}%</strong>
              <small>{operationTotals.activeInfluencers} influenciadores</small>
              <span className={`affiliate-kpi-subpill ${conversionPercentage >= 15 ? 'green' : conversionPercentage > 0 ? 'blue' : 'amber'}`}>
                {conversionPercentage >= 15 ? 'Alta conversão' : conversionPercentage > 0 ? 'Conversão ativa' : 'Iniciando ativações'}
              </span>
            </div>
          </article>
        </div>

        {/* Ranking & Live Feed Container */}
        <div className="affiliate-ops-grid affiliate-ops-grid-wide">
          <div className="affiliate-ranking-card">
            <div className="affiliate-card-head">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpsActiveTab('metrics')}
                    className={`text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 ${opsActiveTab === 'metrics' ? 'text-[var(--ops-text)] underline decoration-2 underline-offset-4 decoration-blue-600' : 'text-[var(--ops-muted)]'}`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Métricas dos Afiliados
                  </button>
                  <span className="text-[var(--ops-muted)] text-xs">|</span>
                  <button
                    type="button"
                    onClick={() => setOpsActiveTab('ranking')}
                    className={`text-xs font-black transition-colors cursor-pointer ${opsActiveTab === 'ranking' ? 'text-[var(--ops-text)] underline decoration-2 underline-offset-4 decoration-blue-600' : 'text-[var(--ops-muted)]'}`}
                  >
                    Ranking de influenciadores
                  </button>
                  <span className="text-[var(--ops-muted)] text-xs">|</span>
                  <button
                    type="button"
                    onClick={() => setOpsActiveTab('feed')}
                    className={`text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 ${opsActiveTab === 'feed' ? 'text-[var(--ops-text)] underline decoration-2 underline-offset-4 decoration-blue-600' : 'text-[var(--ops-muted)]'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Ativações em Tempo Real
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--ops-muted)] font-bold">
                <Gamepad2 className="w-4 h-4"/>
                <span className="hidden sm:inline">Painel de métricas analíticas e conversão</span>
              </div>
            </div>

            {opsActiveTab === 'metrics' ? (
              <div className="p-4 sm:p-5 space-y-5">
                {/* 1. Header Metrics Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Conversão FTD</span>
                    <strong className="text-base font-extrabold text-zinc-900 block mt-0.5">
                      {conversionPercentage.toFixed(1).replace('.', ',')}%
                    </strong>
                    <span className="text-[10px] text-emerald-600 font-semibold">{operationTotals.ftds} ativados</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Ticket Médio</span>
                    <strong className="text-base font-extrabold text-zinc-900 block mt-0.5">
                      R$ {averageTicket > 0 ? averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                    </strong>
                    <span className="text-[10px] text-blue-600 font-semibold">Por depósito</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Volume Total</span>
                    <strong className="text-base font-extrabold text-emerald-600 block mt-0.5">
                      R$ {operationTotals.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                    <span className="text-[10px] text-zinc-500 font-semibold">{operationTotals.registrations} cadastros</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Afiliados Ativos</span>
                    <strong className="text-base font-extrabold text-indigo-600 block mt-0.5">
                      {operationTotals.activeInfluencers || scopedIndications.length}
                    </strong>
                    <span className="text-[10px] text-zinc-500 font-semibold">Na rede ativa</span>
                  </div>
                </div>

                {/* 2. Visual Performance Distribution Chart (Clean Apple style) */}
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 tracking-tight">Distribuição de Receita por Afiliado</h4>
                      <p className="text-[11px] text-zinc-500">Comparativo dos maiores geradores de volume na sua rede</p>
                    </div>
                    <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-600 shadow-2xs">
                      Top Desempenho
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {filteredRankingList.slice(0, 5).map((item, idx) => {
                      const rev = getItemRevenue(item);
                      const ftds = getItemFtds(item);
                      const regs = getItemRegistrations(item);
                      const maxRev = Math.max(1, ...filteredRankingList.map(i => getItemRevenue(i)));
                      const percentWidth = Math.min(100, Math.max(8, (rev / maxRev) * 100));
                      const convRate = regs > 0 ? ((ftds / regs) * 100).toFixed(1) : '0.0';

                      return (
                        <div key={item.id || idx} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 truncate max-w-[220px] sm:max-w-xs">
                              <span className="w-4 h-4 rounded-full bg-zinc-200 text-zinc-700 font-black text-[9px] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <strong className="text-zinc-800 truncate">{item.referredName || 'Afiliado Sem Nome'}</strong>
                              <span className="text-zinc-400 font-mono text-[10px]">({convRate}% conv.)</span>
                            </div>
                            <strong className="text-emerald-700 font-extrabold shrink-0">
                              R$ {rev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div className="h-2 w-full bg-zinc-200/80 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                              style={{ width: `${percentWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {filteredRankingList.length === 0 && (
                      <div className="text-center py-4 text-xs text-zinc-400">
                        Nenhum dado financeiro para gerar o gráfico de distribuição.
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Detailed Metrics by Affiliate (Compact iPhone-style cards & actions) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 tracking-tight">Detalhamento Individual de Métricas</h4>
                    <span className="text-[11px] text-zinc-400">{filteredRankingList.length} afiliados</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredRankingList.slice(0, 8).map((ind, idx) => {
                      const rev = getItemRevenue(ind);
                      const regs = getItemRegistrations(ind);
                      const ftds = getItemFtds(ind);
                      const conv = regs > 0 ? ((ftds / regs) * 100).toFixed(1) : '0.0';
                      const cleanPhone = (ind.phone || '').replace(/\D/g, '');
                      const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}` : null;

                      return (
                        <div
                          key={ind.id || idx}
                          className="bg-white rounded-2xl border border-zinc-200/90 p-3 shadow-2xs hover:border-zinc-300 transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-7 h-7 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-xs flex items-center justify-center shrink-0">
                                {(ind.referredName || 'A').charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <strong className="text-xs font-bold text-zinc-900 block truncate">
                                  {ind.referredName || 'Afiliado'}
                                </strong>
                                <span className="text-[10px] text-zinc-400 block truncate">{ind.referredEmail}</span>
                              </div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 font-mono text-[9px] font-bold text-zinc-600 shrink-0">
                              {ind.referralCode || 'CÓDIGO'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-zinc-100 text-center">
                            <div className="bg-zinc-50 rounded-xl p-1.5">
                              <span className="text-[9px] text-zinc-400 block">Cadastros</span>
                              <strong className="text-[11px] font-bold text-zinc-800">{regs}</strong>
                            </div>
                            <div className="bg-zinc-50 rounded-xl p-1.5">
                              <span className="text-[9px] text-zinc-400 block">FTDs</span>
                              <strong className="text-[11px] font-bold text-blue-700">{ftds}</strong>
                            </div>
                            <div className="bg-zinc-50 rounded-xl p-1.5">
                              <span className="text-[9px] text-zinc-400 block">Conversão</span>
                              <strong className="text-[11px] font-bold text-emerald-700">{conv}%</strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <span className="text-[9px] text-zinc-400 block">Depósitos Gerados</span>
                              <strong className="text-xs font-extrabold text-emerald-600">
                                R$ {rev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>

                            {/* Ultra compact iOS-style button group */}
                            <div className="flex items-center gap-1">
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="h-7 w-7 rounded-xl bg-zinc-100 hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition active:scale-95 shadow-2xs cursor-pointer"
                                  title="WhatsApp"
                                >
                                  <Smartphone className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (ind.referralCode) {
                                    navigator.clipboard.writeText(ind.referralCode);
                                    onShowToast?.(`Código ${ind.referralCode} copiado!`, 'success');
                                  }
                                }}
                                className="h-7 px-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
                                title="Copiar Código"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIndication(ind);
                                  setManageModalOpen(true);
                                }}
                                className="h-7 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold transition active:scale-95 cursor-pointer shadow-2xs"
                              >
                                Detalhes
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : opsActiveTab === 'ranking' ? (
              <>
                {/* Ranking Tools: Search & Sorter */}
                <div className="affiliate-ranking-tools">
                  <div className="affiliate-ranking-search">
                    <Search className="w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou e-mail..."
                      value={opsSearch}
                      onChange={(e) => setOpsSearch(e.target.value)}
                    />
                    {opsSearch && (
                      <button
                        type="button"
                        onClick={() => setOpsSearch('')}
                        className="absolute right-2 top-2 text-[var(--ops-muted)] hover:text-[var(--ops-text)] text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="affiliate-ranking-sort">
                    <span>Ordenar:</span>
                    <select
                      value={opsSortBy}
                      onChange={(e) => setOpsSortBy(e.target.value as any)}
                    >
                      <option value="revenue">Maior Receita</option>
                      <option value="ftds">Mais FTDs</option>
                      <option value="registrations">Mais Cadastros</option>
                      <option value="conversion">Taxa de Conversão</option>
                    </select>
                  </div>
                </div>

                {/* Table Header */}
                <div className="affiliate-ranking-head">
                  <span>Influenciador</span>
                  <span>Cadastros</span>
                  <span>FTDs</span>
                  <span>Receita</span>
                  <span>Jogo</span>
                  <span />
                </div>

                {/* Table Rows (40 per page) */}
                {paginatedRankingList.map((ind, index) => {
                  const absIndex = (rankingPage - 1) * RANKING_PAGE_SIZE + index;
                  const indRevenue = getItemRevenue(ind);
                  const indRegs = getItemRegistrations(ind);
                  const indFtds = getItemFtds(ind);
                  const indConv = getItemConversion(ind);
                  const rankClass = absIndex === 0 ? 'top1' : absIndex === 1 ? 'top2' : absIndex === 2 ? 'top3' : 'other';
                  const rankIcon = absIndex === 0 ? '🥇' : absIndex === 1 ? '🥈' : absIndex === 2 ? '🥉' : `${absIndex + 1}º`;

                  return (
                    <button
                      key={ind.id}
                      onClick={() => setInfluencerMetricsItem(ind)}
                      className="affiliate-ranking-row cursor-pointer"
                      title="Clique para ver métricas detalhadas deste membro"
                    >
                      <span>
                        <span className={`affiliate-rank-badge ${rankClass}`}>{rankIcon}</span>
                        <i>{ind.referredName?.charAt(0).toUpperCase() || 'U'}</i>
                        <em>
                          <span className="flex items-center gap-1.5">
                            {ind.referredName || 'Usuário'}
                            {ind.isInfluencer && (
                              <span className="inline-block px-1.5 py-0.2 text-[8px] font-black rounded bg-purple-100 text-purple-700">
                                Influenciador
                              </span>
                            )}
                          </span>
                          <small>{ind.referredEmail}</small>
                        </em>
                      </span>
                      <strong>
                        {indRegs}
                        <span className="hidden lg:inline text-[8px] text-[var(--ops-muted)] ml-1 font-medium">cadastros</span>
                      </strong>
                      <strong>
                        {indFtds}
                        <span className="hidden lg:inline text-[8px] text-[var(--ops-muted)] ml-1 font-medium">FTDs</span>
                      </strong>
                      <strong className="money">
                        R$ {indRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="flex items-center gap-1">
                        <span className="game-pill">{ind.lastGameName || 'Block Win'}</span>
                        {indConv > 0 && (
                          <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                            {indConv.toFixed(0)}%
                          </span>
                        )}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--ops-muted)]"/>
                    </button>
                  );
                })}

                {filteredRankingList.length > 0 && (
                  <Pagination
                    currentPage={rankingPage}
                    totalItems={filteredRankingList.length}
                    pageSize={RANKING_PAGE_SIZE}
                    onPageChange={setRankingPage}
                    itemLabel="membros no ranking"
                    className="mt-3"
                  />
                )}

                {filteredRankingList.length === 0 && (
                  <div className="affiliate-empty flex flex-col items-center justify-center p-8 text-center gap-2">
                    <Users className="w-7 h-7 text-[var(--ops-muted)] opacity-50"/>
                    <span className="font-bold text-xs text-[var(--ops-text)]">Nenhum registro encontrado com os filtros selecionados.</span>
                    <p className="text-[11px] text-[var(--ops-muted)] max-w-sm">
                      Compartilhe seu link de afiliado para registrar novas adesões na sua rede.
                    </p>
                    <button
                      type="button"
                      onClick={onCopySuccess}
                      className="mt-2 px-3.5 py-1.5 bg-[#111111] hover:bg-zinc-800 text-white rounded-lg text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      Copiar Link de Convite
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Real-time Activity Feed */
              <div className="affiliate-feed-list">
                {rawIndicationsList.length > 0 ? (
                  rawIndicationsList.slice(0, 8).map((item, idx) => {
                    const hasDep = Number(item.totalDeposited || 0) + Number(item.subNetworkDeposits || 0) > 0;
                    return (
                      <div key={item.id || idx} className="affiliate-feed-item">
                        <div className="affiliate-feed-item-info">
                          <div className={`affiliate-feed-item-icon ${hasDep ? 'deposit' : 'reg'}`}>
                            {hasDep ? <BadgeDollarSign className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4>
                              {hasDep
                                ? `FTD / Depósito Confirmado • R$ ${Number(item.totalDeposited || item.subNetworkDeposits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : `Novo Jogador Cadastrado na Rede`}
                            </h4>
                            <p>
                              Usuário: <b>{item.referredName}</b> ({item.referredEmail}) • Jogo: {item.lastGameName || 'Block Win'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`affiliate-feed-badge ${hasDep ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                            {hasDep ? 'Confirmado' : 'Registrado'}
                          </span>
                          <p className="text-[7px] text-[var(--ops-muted)] mt-1">Ao vivo</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="affiliate-empty p-6 text-center text-xs text-[var(--ops-muted)]">
                    Nenhuma atividade recente registrada na rede.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <Modal isOpen={notificationCenterOpen} onClose={()=>setNotificationCenterOpen(false)} title="Notificações" subtitle="Escolha quais eventos deseja acompanhar" className="affiliate-clean-notifications" maxWidth={460}>
          <div className="affiliate-mode-picker"><button className={notificationMode === 'simple' ? 'active' : ''} onClick={() => setNotificationMode('simple')}>Simples<small>Evento e valor</small></button><button className={notificationMode === 'detailed' ? 'active' : ''} onClick={() => setNotificationMode('detailed')}>Detalhada<small>Influenciador, jogador e jogo</small></button></div>
          <div className="affiliate-notification-list">
            {[
              ['registration','Novo cadastro','Quem indicou e horário',UserPlus],
              ['ftd','FTD confirmado','Influenciador, jogador e valor',CheckCircle2],
              ['pixPending','PIX pendente','Cobrança aguardando pagamento',Clock3],
              ['gameActivity','Atividade por jogo','Jogo acessado pelo indicado',Gamepad2],
            ].map(([key,title,description,Icon]) => <label key={String(key)}><span><i><Icon className="w-4 h-4"/></i><em>{title}<small>{description}</small></em></span><input type="checkbox" checked={(notificationPrefs as any)[key as string]} onChange={e => setNotificationPrefs(prev => ({...prev,[String(key)]:e.target.checked}))}/></label>)}
          </div>
          <div className="affiliate-notification-preview"><span>PRÉVIA • {notificationMode === 'simple' ? 'SIMPLES' : 'DETALHADA'}</span><strong>Novo FTD • R$ 100,00</strong>{notificationMode === 'detailed' && <p>Influenciador: Marina S. • Jogador: Carlos M. • GEN DINO</p>}</div>
          <button type="button" onClick={enableAffiliateNotifications} className={`affiliate-enable-notifications ${browserNotificationsEnabled ? 'enabled' : ''}`}><Bell className="w-4 h-4"/>{browserNotificationsEnabled ? 'Notificações ativas' : 'Ativar notificações no aparelho'}</button>
      </Modal>

      {/* Indications List */}
      <div id="af-network" className="affiliate-network-panel space-y-3 pt-2">
        <div className="af-network-heading"><div><span className="af-kicker">RELACIONAMENTOS</span><h2>Minha rede</h2><p>Encontre suas indicações e acompanhe os depósitos registrados.</p></div><button type="button" disabled={!filteredIndications.length} onClick={()=>downloadReportCsv('minha-rede.csv',['Nome','Cadastro','Perfil','Depósitos diretos (BRL)'],filteredIndications.map(i=>[i.referredName,i.createdAt,i.isInfluencer?'Influenciador':'Jogador',Number(i.totalDeposited||0)]))}><ArrowDownLeft size={16}/>Exportar seleção</button></div>
        <div className="af-network-summary"><span><strong>{rawIndicationsList.length}</strong> indicações carregadas</span><span><strong>{rawIndicationsList.filter(i=>Number(i.totalDeposited||0)>0).length}</strong> com depósito direto</span><span>Os filtros abaixo alteram a lista e a exportação.</span></div>
        {/* Controls Bar: Category Filters + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-2xl border border-[#E5E5E5] shadow-2xs">
          {/* Filters for Jogadores / Influenciadores */}
          <div className="flex items-center bg-[#F5F5F5] p-1 rounded-xl border border-[#E5E5E5] gap-1 self-start sm:self-auto shrink-0 max-w-full overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterType('players')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                filterType === 'players' ? 'bg-[#111111] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jogadores ({rawIndicationsList.filter(i => !i.isInfluencer).length})
            </button>
            <button
              onClick={() => setFilterType('influencers')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                filterType === 'influencers' ? 'bg-[#111111] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <img src={logoImg} alt="Logo" className="h-3.5 max-w-[20px] object-contain" />
              Influenciadores ({rawIndicationsList.filter(i => i.isInfluencer).length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
            <select value={gameFilter} onChange={(e) => setGameFilter(e.target.value as typeof gameFilter)} className="bg-[#F5F5F5] border border-[#E5E5E5] text-[11px] font-semibold text-[#111111] px-2.5 py-1.5 rounded-xl outline-none">
              <option value="all">🎮 Todos os Jogos</option>
              <option value="g_count_masters">Count Masters</option>
                <option value="g_subway_pay">🏃 Subway Pay</option>
              <option value="g_bubble_blast">🫧 Bubble Blast</option>
              <option value="g_block_puzzle">🧩 Block Win</option>
              <option value="g_gen_dino">🦖 GEN DINO</option>
              <option value="g_raspa_fortuna">🍀 Raspa Fortuna</option>
            </select>
            <select value={depositFilter} onChange={(e) => setDepositFilter(e.target.value as typeof depositFilter)} className="bg-[#F5F5F5] border border-[#E5E5E5] text-[11px] font-semibold text-[#111111] px-2.5 py-1.5 rounded-xl outline-none">
              <option value="all">Todos da minha rede</option>
              <option value="deposited">Com depósito</option>
              <option value="no_deposit">Sem depósito</option>
            </select>
            <select value={networkSort} onChange={(e) => setNetworkSort(e.target.value as typeof networkSort)} className="bg-[#F5F5F5] border border-[#E5E5E5] text-[11px] font-semibold text-[#111111] px-2.5 py-1.5 rounded-xl outline-none">
              <option value="recent">Mais recentes</option>
              <option value="deposits">Maior depósito</option>
              <option value="name">Nome A–Z</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-full sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full bg-[#F5F5F5] focus:bg-white border border-[#E5E5E5] focus:border-[#111111] text-xs font-medium text-[#111111] pl-8 pr-7 py-1.5 rounded-xl outline-none transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <h3 className="afn-result-count">
            Exibindo {filteredIndications.length} usuário{filteredIndications.length !== 1 ? 's' : ''}
          </h3>
        </div>

        {filteredIndications.length > 0 ? (
          <>
            <div className="afn-list">
              <div className="afn-list-heading" aria-hidden="true"><span>Usuário</span><span>Origem / Perfil</span><span>Depósitos</span><span>Saldo / Comissão</span><span>Ações</span></div>
              {paginatedIndications.map(ind=><AffiliateNetworkRow key={ind.id} item={ind} onManage={()=>{setSelectedIndication(ind);setManageModalOpen(true);}} onMetrics={()=>setInfluencerMetricsItem(ind)}/>)}
            </div>

          {/* 40 per page Pagination for Indications */}
          <Pagination
            currentPage={indicationsPage}
            totalItems={filteredIndications.length}
            pageSize={INDICATIONS_PAGE_SIZE}
            onPageChange={setIndicationsPage}
            itemLabel={filterType === 'players' ? 'jogadores' : 'influenciadores'}
            className="mt-3"
          />
        </>
      ) : (
          <div className="p-6 bg-[#F5F5F5] rounded-2xl border border-dashed border-[#E5E5E5] text-center text-xs text-[#737373] space-y-1">
            <ShieldCheck className="w-6 h-6 mx-auto text-[#737373] mb-1" />
            <p className="font-medium text-[#111111]">Nenhum usuário nesta categoria</p>
            <p>Alterne entre os filtros ou compartilhe seu link de indicação.</p>
          </div>
        )}
      </div>

      {/* POPUP INFLUENCER METRICS MODAL */}
      {influencerMetricsItem && <Modal isOpen onClose={()=>setInfluencerMetricsItem(null)} title={influencerMetricsItem.referredName || 'Indicador'} subtitle={influencerMetricsItem.referredEmail} maxWidth={540} className="affiliate-clean-metrics"><div className="space-y-4">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Total Depósitos da Rede */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Depósitos Gerados na Rede
                  </span>
                  <span className="text-lg font-extrabold text-emerald-700 font-mono">
                    R$ {(influencerMetricsItem.subNetworkDeposits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Volume acumulado depositado pelos indicados do influenciador
                  </span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-[#111111] text-emerald-400 flex items-center justify-center shadow-2xs shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>

              {/* Saldo Total Trazido Pela Rede */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-slate-800" /> Saldo Total Trazido Pela Rede
                  </span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    R$ {(influencerMetricsItem.subNetworkBalances || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Soma dos saldos atuais nas contas dos jogadores indicados
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
              </div>

              {/* Total Cadastros / Indicados */}
              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0]">
                <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center mb-1.5">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 block">Cadastros na Rede</span>
                <span className="text-sm font-bold text-[#111111] block font-mono mt-0.5">
                  {influencerMetricsItem.subReferralsCount || 0} <span className="text-[10px] font-normal text-slate-500">jogadores</span>
                </span>
              </div>

              {/* Saldo de Comissão de Afiliado */}
              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0]">
                <div className="w-6 h-6 rounded-lg bg-amber-100 p-1 flex items-center justify-center mb-1.5">
                  <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 block">Saldo de Comissão</span>
                <span className="text-sm font-bold text-[#111111] block font-mono mt-0.5">
                  R$ {(influencerMetricsItem.affiliateBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Taxa de Comissão & Margem Garantida */}
              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                    Acordo de Comissão (RevShare)
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 font-mono">
                      Influenciador: {influencerMetricsItem.influencerRate ?? 50}%
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-mono">
                      Sua Margem: {Math.max(10, (activeInfo.revSharePercent ?? 70) - (influencerMetricsItem.influencerRate ?? 50))}%
                    </span>
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <span>Margem mínima: <strong>10%</strong></span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  const current = influencerMetricsItem;
                  setInfluencerMetricsItem(null);
                  setSelectedIndication(current);
                  setManageModalOpen(true);
                }}
                className="flex-1 py-2.5 bg-[#111111] hover:bg-black text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Gerenciar Permissões / Saldo</span>
              </button>

              <button
                onClick={() => setInfluencerMetricsItem(null)}
                className="px-4 py-2.5 bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#111111] border border-[#E5E5E5] rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
        </div></Modal>}

      <ManageIndicatedModal
        isOpen={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        indication={selectedIndication}
        affiliateRevShare={activeInfo.revSharePercent ?? 70}
        isAdmin={isAdmin}
        onShowToast={onShowToast}
        onSaveSuccess={(updated) => {
          const updatedList = rawIndicationsList.map((item) =>
            (item.id === updated.id || item.referredUserId === updated.referredUserId)
              ? updated
              : item
          );
          setLocalIndications(updatedList);
        }}
      />

      <AffiliateWithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        affiliateBalance={activeInfo.affiliateBalance || 0}
        withdrawFee={activeInfo.withdrawFee ?? 0}
        onWithdrawSuccess={(newBalance) => {
          if (internalAffiliateInfo) {
            setInternalAffiliateInfo((prev) => prev ? { ...prev, affiliateBalance: newBalance } : null);
          }
          if (onRefresh) onRefresh();
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};
